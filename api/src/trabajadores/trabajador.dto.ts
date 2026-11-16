import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CrearTrabajadorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  sueldoBase: number;
}

export class ActualizarTrabajadorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  sueldoBase?: number;
}

export class SemanaQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'desde debe tener formato AAAA-MM-DD' })
  desde: string;
}
