import { HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
@Injectable()
export class BusinessService {
  constructor(private readonly db: DatabaseProvider) {}
}
