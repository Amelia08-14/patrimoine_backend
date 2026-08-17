import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { UserType, AccountStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async register(createAuthDto: CreateAuthDto) {
    const { 
      email, password, firstName, lastName, phone,
      userType, companyName, activityType, commercialRegister, townId, townCode
    } = createAuthDto;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const resolvedUserType = (userType || UserType.PARTICULIER) as any;
    if (resolvedUserType === UserType.SOCIETE) {
      if (!companyName || !activityType || !commercialRegister) {
        throw new BadRequestException("Champs société incomplets");
      }
    }

    const resolvedTownId: number | undefined = townId ? Number(townId) : undefined;

    // Créer l'utilisateur
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        userType: resolvedUserType, // Prisma Enum
        companyName,
        companyActivity: activityType as any, // Prisma Enum
        commercialRegister,
        townId: resolvedTownId,
        activated: false, // Compte désactivé par défaut (email)
        adminVerified: false, // Non validé par l'admin par défaut
        activationKey: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), // Générer une clé
      },
    });

    // SIMULATION D'ENVOI D'EMAIL (Dans un vrai projet, utiliser Nodemailer)
    console.log(`
    ========================================================
    📧 EMAIL SIMULÉ - ACTIVATION DE COMPTE
    --------------------------------------------------------
    À: ${user.email}
    Sujet: Activation de votre compte Patrimoine Immobilier
    
    Bonjour ${user.firstName || 'Cher client'},
    
    Veuillez cliquer ci-dessous pour activer votre compte :
    http://localhost:3001/auth/activate?key=${user.activationKey}
    
    Cordialement,
    Patrimoine Immobilier
    ========================================================
    `);

    return {
      message: 'Inscription réussie. Veuillez vérifier votre email pour activer votre compte.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        userType: user.userType,
      },
    };
  }

  async activateAccount(key: string) {
    const user = await this.prisma.user.findFirst({
      where: { activationKey: key },
    });

    if (!user) {
      throw new UnauthorizedException('Clé d\'activation invalide');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        activated: true,
        activationKey: null, // Invalider la clé après usage
      },
    });

    return { message: 'Compte activé avec succès' };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const normalizedEmail = email.trim().toLowerCase();

    // Trouver l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (!user.activated) {
        throw new UnauthorizedException('Votre compte n\'est pas encore activé. Veuillez vérifier vos emails.');
    }

    // Vérifier si la société est validée par l'admin (Optionnel : Bloquer la connexion ou juste restreindre l'accès)
    // Le User souhaite "une validation par l'administrateur est nécessaire".
    // On peut laisser se connecter mais isProfileComplete ou une autre propriété bloquera l'accès.
    // Ou on bloque ici.
    // Pour l'instant, on laisse passer mais on renvoie l'info adminVerified.
    
    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Statut de compte (suspendu / bloqué par l'administrateur)
    if (user.accountStatus === AccountStatus.BLOCKED) {
      throw new UnauthorizedException(
        user.statusReason ? `Compte bloqué : ${user.statusReason}` : 'Votre compte a été bloqué. Contactez le support.'
      );
    }
    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw new UnauthorizedException(
        user.statusReason ? `Compte suspendu : ${user.statusReason}` : 'Votre compte est suspendu. Contactez le support.'
      );
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    // Vérifier si le profil est complet (basé sur le type)
    let isProfileComplete = true;
    if (user.userType === 'PARTICULIER') {
        // Pour un particulier, on vérifie si l'adresse et la date de naissance sont remplis
        if (!user.address || !user.dateOfBirth) isProfileComplete = false;
    } else if (user.userType === 'SOCIETE') {
        // Pour une société, on vérifie les documents
        // if (!user.rcDocumentUrl || !user.agreementDocumentUrl) isProfileComplete = false;
        // Pour l'instant on simplifie, on considère incomplet si pas d'adresse
        if (!user.address) isProfileComplete = false;
    }

    // Générer le token JWT
    const payload = { 
        sub: user.id, 
        email: user.email,
        isProfileComplete,
        userType: user.userType 
    };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        companyName: user.companyName,
        companyActivity: user.companyActivity,
        agencyLogoUrl: user.agencyLogoUrl,
        isProfileComplete,
        adminVerified: user.adminVerified
      },
    };
  }
}
