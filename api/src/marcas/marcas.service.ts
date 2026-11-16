import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { validarMarca } from '../calculo/calculo.service';
import { Trabajador } from '../trabajadores/trabajador.entity';
import { CrearMarcaDto } from './marca.dto';
import { Marca } from './marca.entity';

@Injectable()
export class MarcasService {
  constructor(
    @InjectRepository(Marca) private readonly marcas: Repository<Marca>,
    @InjectRepository(Trabajador) private readonly trabajadores: Repository<Trabajador>,
  ) {}

  async registrar(dto: CrearMarcaDto) {
    const entrada = new Date(dto.entrada);
    const salida = new Date(dto.salida);
    validarMarca({ entrada, salida }); // 400 si la salida no es posterior

    if (!(await this.trabajadores.existsBy({ id: dto.trabajadorId }))) {
      throw new NotFoundException(`No existe el trabajador ${dto.trabajadorId}`);
    }

    // Dos marcas del mismo trabajador no pueden solaparse: contarian horas dobles.
    const solapadas = await this.marcas
      .createQueryBuilder('m')
      .where('m.trabajadorId = :id', { id: dto.trabajadorId })
      .andWhere('m.entrada < :salida AND m.salida > :entrada', { entrada, salida })
      .getCount();
    if (solapadas > 0) throw new ConflictException('La marca se solapa con otra ya registrada');

    return this.marcas.save(this.marcas.create({ trabajadorId: dto.trabajadorId, entrada, salida }));
  }
}
