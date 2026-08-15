import { Controller, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Controller('contacts')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @UseInterceptors(FileInterceptor('attachment', {
    storage: diskStorage({
      destination: './uploads/contacts',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo, cf. spécification (PNG, JPG, PDF max 10Mo)
  }))
  create(@Body() createContactDto: CreateContactDto, @UploadedFile() attachment?: Express.Multer.File) {
    return this.contactService.create({
      ...createContactDto,
      attachmentUrl: attachment ? `/uploads/contacts/${attachment.filename}` : undefined,
    });
  }
}
