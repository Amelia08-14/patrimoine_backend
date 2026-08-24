import { Controller, Get, Patch, Param, Body, UseGuards, Req, Put, Delete, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnnounceStatus, AccountStatus } from '@prisma/client';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard-stats')
  async getDashboardStats(@Req() req: any) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.getDashboardStats();
  }

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

  @Put('users/:id/password')
  async resetUserPassword(@Req() req: any, @Param('id') id: string, @Body() body: { newPassword: string }) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.resetUserPassword(Number(id), body.newPassword);
  }

  @Get('partners')
  async getPartners(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('status') status?: 'ALL' | 'ACTIVE' | 'PENDING' | 'SUSPENDED',
    @Query('accountType') accountType?: 'ALL' | 'PRO' | 'PARTICULIER',
    @Query('pole') pole?: 'ALL' | 'IMMOBILIER' | 'HOTELLERIE' | 'EVENEMENTIEL' | 'ENTREPOSAGE',
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.getPartners({ search, status, accountType, pole });
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

  @Patch('announces/:id/feature')
  async featureAnnounce(@Req() req: any, @Param('id') id: string, @Body() body: { durationDays?: number }) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.featureAnnounce(Number(id), body.durationDays ?? 30);
  }

  @Patch('announces/:id/unfeature')
  async unfeatureAnnounce(@Req() req: any, @Param('id') id: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.unfeatureAnnounce(Number(id));
  }

  @Get('announces/featured-kpis')
  async getFeaturedKpis(@Req() req: any) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.getFeaturedKpis();
  }

  @Get('purchases')
  async getAllPurchases(
    @Req() req: any,
    @Query('wilaya') wilaya?: string,
    @Query('commune') commune?: string,
    @Query('search') search?: string,
    @Query('accountType') accountType?: 'ALL' | 'PARTICULIER' | 'SOCIETE',
    @Query('source') source?: 'ALL' | 'POINTS' | 'BOUTIQUE',
    @Query('status') status?: string,
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.getAllPurchases({ wilaya, commune, search, accountType, source, status });
  }

  @Get('contacts')
  async getContacts(
    @Req() req: any,
    @Query('motif') motif?: string,
    @Query('status') status?: string,
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.getContacts({ motif, status });
  }

  @Patch('contacts/:id/status')
  async updateContactStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.updateContactStatus(Number(id), body.status);
  }

  @Get('search')
  async globalSearch(@Req() req: any, @Query('q') q: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.adminService.globalSearch(q || '');
  }
}
