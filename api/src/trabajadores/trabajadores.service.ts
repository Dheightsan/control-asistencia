import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalculoService, ResultadoSemana } from '../calculo/calculo.service';
import { Marca } from '../marcas/marca.entity';
import { ActualizarTrabajadorDto, CrearTrabajadorDto } from './trabajador.dto';
import { Trabajador } from './trabajador.entity';

const DIA_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TrabajadoresService {
  constructor(
    @InjectRepository(Trabajador) private readonly trabajadores: Repository<Trabajador>,
    @InjectRepository(Marca) private readonly marcas: Repository<Marca>,
    private readonly calculo: CalculoService,
  ) {}

  listar() {
    return this.trabajadores.find({ order: { id: 'ASC' } });
  }

  async obtener(id: number) {
    const trabajador = await this.trabajadores.findOneBy({ id });
    if (!trabajador) throw new NotFoundException(`No existe el trabajador ${id}`);
    return trabajador;
  }

  crear(dto: CrearTrabajadorDto) {
    return this.trabajadores.save(this.trabajadores.create(dto));
  }

  async actualizar(id: number, dto: ActualizarTrabajadorDto) {
    const trabajador = await this.obtener(id);
    return this.trabajadores.save(Object.assign(trabajador, dto));
  }

  async eliminar(id: number) {
    const trabajador = await this.obtener(id);
    await this.trabajadores.remove(trabajador);
  }

  async semana(id: number, desde: string): Promise<ResultadoSemana> {
    const trabajador = await this.obtener(id);
    const inicio = new Date(`${desde}T00:00:00Z`);
    if (Number.isNaN(inicio.getTime())) throw new BadRequestException('desde no es una fecha valida');
    // Se traen las marcas que tocan la ventana, incluida una que empiece el dia anterior y cruce medianoche.
    const fin = new Date(inicio.getTime() + 7 * DIA_MS);
    const marcas = await this.marcas
      .createQueryBuilder('m')
      .where('m.trabajadorId = :id', { id })
      .andWhere('m.salida > :inicio AND m.entrada < :fin', { inicio, fin })
      .getMany();
    return this.calculo.calcularSemana(marcas, trabajador.sueldoBase, desde);
  }
}
