import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrearMarcaDto } from './marca.dto';
import { MarcasService } from './marcas.service';

@ApiTags('marcas')
@Controller('marcas')
export class MarcasController {
  constructor(private readonly servicio: MarcasService) {}

  @Post()
  registrar(@Body() dto: CrearMarcaDto) {
    return this.servicio.registrar(dto);
  }
}
