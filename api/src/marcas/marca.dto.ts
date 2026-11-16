import { IsInt, IsISO8601, Min } from 'class-validator';

export class CrearMarcaDto {
  @IsInt()
  @Min(1)
  trabajadorId: number;

  // ISO 8601, por ejemplo 2026-05-04T09:00:00Z
  @IsISO8601({ strict: true })
  entrada: string;

  @IsISO8601({ strict: true })
  salida: string;
}
