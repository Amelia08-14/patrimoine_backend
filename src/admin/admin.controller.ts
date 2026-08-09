import { Controller, Get, Patch, Param, Body, UseGuards, Req, Put, Delete, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnnounceStatus, AccountStatus } from '@prisma/client';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getAllUsers(
    @Req() req: any,
    @Query('wilaya') wilaya?: string,
    @Query('commune') commune?: string,
    @Query('search') search?: string,
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.getAllUsers({ wilaya, commune, search });
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

  @Put('users/:id/status')
  async updateUserStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: AccountStatus; reason?: string }) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.updateUserStatus(Number(id), body.status, body.reason);
  }

  @Delete('users/:id')
  async deleteUser(@Req() req: any, @Param('id') id: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.rejectUser(Number(id));
  }

  @Get('announces')
  async getAllAnnounces(
    @Req() req: any,
    @Query('wilaya') wilaya?: string,
    @Query('commune') commune?: string,
    @Query('search') search?: string,
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.getAllAnnounces({ wilaya, commune, search });
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

  @Get('search')
  async globalSearch(@Req() req: any, @Query('q') q: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.globalSearch(q || '');
  }
}
