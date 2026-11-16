import { Body, Controller, Post } from '@nestjs/common';
import { CrearMarcaDto } from './marca.dto';
import { MarcasService } from './marcas.service';

@Controller('marcas')
export class MarcasController {
  constructor(private readonly servicio: MarcasService) {}

  @Post()
  registrar(@Body() dto: CrearMarcaDto) {
    return this.servicio.registrar(dto);
  }
}
