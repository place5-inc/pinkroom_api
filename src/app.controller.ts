import { Controller, Get } from '@nestjs/common';
import { DatabaseProvider } from './libs/db';

@Controller()
export class AppController {
  constructor(private readonly db: DatabaseProvider) {}

  @Get('healthcheck')
  async healthCheck() {
    try {
      await this.db.selectFrom('users').selectAll().executeTakeFirst();

      return 'Healthy';
    } catch (error) {
      console.error(error);
      return 'Unhealthy';
    }
  }
}
