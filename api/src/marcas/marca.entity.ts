import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Trabajador } from '../trabajadores/trabajador.entity';

@Entity('marcas')
export class Marca {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  trabajadorId: number;

  @ManyToOne(() => Trabajador, (t) => t.marcas, { onDelete: 'CASCADE' })
  trabajador: Trabajador;

  @Column({ type: 'timestamptz' })
  entrada: Date;

  @Column({ type: 'timestamptz' })
  salida: Date;
}
