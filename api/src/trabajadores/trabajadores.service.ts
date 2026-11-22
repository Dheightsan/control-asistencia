import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta, evaluarSemana } from '../alertas/alertas';
import { EXPLICADOR_IA, Explicador, explicar } from '../alertas/explicador';
import { CalculoService, ResultadoSemana } from '../calculo/calculo.service';
import { Marca } from '../marcas/marca.entity';
import { ActualizarTrabajadorDto, CrearTrabajadorDto } from './trabajador.dto';
import { Trabajador } from './trabajador.entity';

const DIA_MS = 24 * 60 * 60 * 1000;

export interface RespuestaAlertas {
  desde: string;
  hasta: string;
  explicadoCon: 'plantilla' | 'ia';
  alertas: (Alerta & { explicacion: string })[];
}

@Injectable()
export class TrabajadoresService {
  constructor(
    @InjectRepository(Trabajador) private readonly trabajadores: Repository<Trabajador>,
    @InjectRepository(Marca) private readonly marcas: Repository<Marca>,
    private readonly calculo: CalculoService,
    @Inject(EXPLICADOR_IA) private readonly ia: Explicador | null,
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

  // Marcas que tocan la ventana, incluida una que empiece el dia anterior y cruce medianoche.
  private async marcasDeSemana(id: number, desde: string): Promise<Marca[]> {
    const inicio = new Date(`${desde}T00:00:00Z`);
    if (Number.isNaN(inicio.getTime())) throw new BadRequestException('desde no es una fecha valida');
    const fin = new Date(inicio.getTime() + 7 * DIA_MS);
    return this.marcas
      .createQueryBuilder('m')
      .where('m.trabajadorId = :id', { id })
      .andWhere('m.salida > :inicio AND m.entrada < :fin', { inicio, fin })
      .getMany();
  }

  async semana(id: number, desde: string): Promise<ResultadoSemana> {
    const trabajador = await this.obtener(id);
    const marcas = await this.marcasDeSemana(id, desde);
    return this.calculo.calcularSemana(marcas, trabajador.sueldoBase, desde);
  }

  async alertas(id: number, desde: string): Promise<RespuestaAlertas> {
    await this.obtener(id);
    const marcas = await this.marcasDeSemana(id, desde);
    const lista = evaluarSemana(marcas, desde);
    const { explicaciones, explicadoCon } = await explicar(lista, this.ia);
    const hasta = new Date(Date.parse(`${desde}T00:00:00Z`) + 6 * DIA_MS).toISOString().slice(0, 10);
    return { desde, hasta, explicadoCon, alertas: lista.map((a, i) => ({ ...a, explicacion: explicaciones[i] })) };
  }
}
