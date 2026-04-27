import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MaarlabPartnerCredential,
  MaarlabPartnerCredentialSchema,
} from './entities/maarlab-partner-credential.entity';
import { MaarlabCredentialsService } from './maarlab-credentials.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: MaarlabPartnerCredential.name,
        schema: MaarlabPartnerCredentialSchema,
      },
    ]),
  ],
  providers: [MaarlabCredentialsService],
  exports: [MaarlabCredentialsService, MongooseModule],
})
export class MaarlabCredentialsModule {}
