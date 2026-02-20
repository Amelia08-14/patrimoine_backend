import { Controller, Get, Patch, Param, Body, UseGuards, Req, Put, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnnounceStatus } from '@prisma/client';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getAllUsers(@Req() req: any) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.getAllUsers();
  }

  @Get('users/pending')
  async getPendingUsers(@Req() req: any) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.getPendingUsers();
  }

  @Put('users/:id/validate')
  async validateUser(@Req() req: any, @Param('id') id: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.validateUser(Number(id));
  }

  @Delete('users/:id')
  async deleteUser(@Req() req: any, @Param('id') id: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.rejectUser(Number(id));
  }

  @Get('announces')
  async getAllAnnounces(@Req() req: any) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.getAllAnnounces();
  }

  @Get('announces/pending')
  async getPendingAnnounces(@Req() req: any) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.getPendingAnnounces();
  }

  @Patch('announces/:id/status')
  async updateAnnounceStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: AnnounceStatus }) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.updateAnnounceStatus(Number(id), body.status);
  }
}
