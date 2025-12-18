import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';

@Injectable()
export class UserRepository {
  constructor(private readonly db: DatabaseProvider) {}
}
