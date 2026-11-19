import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActualizarTrabajadorDto, CrearTrabajadorDto, SemanaQueryDto } from './trabajador.dto';
import { TrabajadoresService } from './trabajadores.service';

@ApiTags('trabajadores')
@Controller('trabajadores')
export class TrabajadoresController {
  constructor(private readonly servicio: TrabajadoresService) {}

  @Get()
  listar() {
    return this.servicio.listar();
  }

  @Post()
  crear(@Body() dto: CrearTrabajadorDto) {
    return this.servicio.crear(dto);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @Patch(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarTrabajadorDto) {
    return this.servicio.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.eliminar(id);
  }

  @Get(':id/semana')
  semana(@Param('id', ParseIntPipe) id: number, @Query() query: SemanaQueryDto) {
    return this.servicio.semana(id, query.desde);
  }
}
