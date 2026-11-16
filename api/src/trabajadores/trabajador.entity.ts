import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Marca } from '../marcas/marca.entity';

@Entity('trabajadores')
export class Trabajador {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  // Sueldo base mensual en pesos chilenos (entero).
  @Column({ type: 'int' })
  sueldoBase: number;

  @OneToMany(() => Marca, (marca) => marca.trabajador)
  marcas: Marca[];
}
