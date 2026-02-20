import { PartialType } from '@nestjs/mapped-types';
import { CreateAnnounceDto } from './create-announce.dto';

export class UpdateAnnounceDto extends PartialType(CreateAnnounceDto) {}
