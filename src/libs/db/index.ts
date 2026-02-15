import {
  CallbackSelection,
  DeleteQueryBuilder,
  DeleteResult,
  InsertQueryBuilder,
  InsertResult,
  Kysely,
  KyselyPlugin,
  MergeQueryBuilder,
  MergeResult,
  MssqlDialect,
  SelectCallback,
  SelectExpression,
  Selection,
  SelectQueryBuilder,
  TableExpression,
  Transaction,
  UpdateQueryBuilder,
  UpdateResult,
} from 'kysely';
import * as tedious from 'tedious';
import * as tarn from 'tarn';
import { DB } from './types';
import { Injectable, Scope } from '@nestjs/common';
import {
  ExtractTableAlias,
  From,
  FromTables,
  AnyAliasedTable,
  PickTableWithAlias,
  TableReference,
} from 'kysely/dist/cjs/parser/table-parser';
import {
  CommonTableExpression,
  RecursiveCommonTableExpression,
} from 'kysely/dist/cjs/parser/with-parser';
import { CTEBuilderCallback } from 'kysely/dist/cjs/query-builder/cte-builder';

@Injectable({ scope: Scope.REQUEST })
export class DatabaseProvider {
  private readonly db = new Kysely<DB>({
    dialect: new MssqlDialect({
      tarn: {
        ...tarn,
        options: {
          min: 0,
          max: 10,
        },
      },
      tedious: {
        ...tedious,
        connectionFactory: () =>
          new tedious.Connection({
            authentication: {
              options: {
                password: process.env.SQLSERVER_PASSWORD ?? 'rlatjqj#@!',
                userName: process.env.SQLSERVER_USER ?? 'kimserver',
              },
              type: 'default',
            },
            options: {
              database: process.env.SQLSERVER_DB ?? 'pinkroom',
              port: Number(process.env.SQLSERVER_PORT ?? '3342'),
              trustServerCertificate: true,
              encrypt: true,
            },
            server:
              process.env.SQLSERVER_HOST ??
              'kim-mssql.public.6a578cca366e.database.windows.net',
          }),
      },
    }),
  });
  private trx: Transaction<DB> | null = null;

  getExecutor() {
    return this.context().getExecutor();
  }

  selectFrom<TE extends keyof DB & string>(
    from: TE[],
  ): SelectQueryBuilder<DB, ExtractTableAlias<DB, TE>, {}>;
  selectFrom<TE extends TableExpression<DB, never>>(
    from: TE[],
  ): SelectQueryBuilder<From<DB, TE>, FromTables<DB, never, TE>, {}>;
  selectFrom<TE extends keyof DB & string>(
    from: TE,
  ): SelectQueryBuilder<DB, ExtractTableAlias<DB, TE>, {}>;
  selectFrom<TE extends AnyAliasedTable<DB>>(
    from: TE,
  ): SelectQueryBuilder<
    DB & PickTableWithAlias<DB, TE>,
    ExtractTableAlias<DB & PickTableWithAlias<DB, TE>, TE>,
    {}
  >;
  selectFrom<TE extends TableExpression<DB, never>>(
    from: TE,
  ): SelectQueryBuilder<From<DB, TE>, FromTables<DB, never, TE>, {}>;
  selectFrom(from) {
    return this.context().selectFrom(from);
  }

  selectNoFrom<SE extends SelectExpression<DB, never>>(
    selections: ReadonlyArray<SE>,
  ): SelectQueryBuilder<DB, never, Selection<DB, never, SE>>;
  selectNoFrom<CB extends SelectCallback<DB, never>>(
    callback: CB,
  ): SelectQueryBuilder<DB, never, CallbackSelection<DB, never, CB>>;
  selectNoFrom<SE extends SelectExpression<DB, never>>(
    selection: SE,
  ): SelectQueryBuilder<DB, never, Selection<DB, never, SE>>;
  selectNoFrom(arg) {
    return this.context().selectNoFrom(arg);
  }

  insertInto<T extends keyof DB & string>(
    table: T,
  ): InsertQueryBuilder<DB, T, InsertResult>;
  insertInto(table) {
    return this.context().insertInto(table);
  }

  replaceInto<T extends keyof DB & string>(
    table: T,
  ): InsertQueryBuilder<DB, T, InsertResult>;
  replaceInto(table) {
    return this.context().replaceInto(table);
  }

  deleteFrom<TR extends keyof DB & string>(
    from: TR[],
  ): DeleteQueryBuilder<DB, ExtractTableAlias<DB, TR>, DeleteResult>;
  deleteFrom<TR extends TableReference<DB>>(
    tables: TR[],
  ): DeleteQueryBuilder<From<DB, TR>, FromTables<DB, never, TR>, DeleteResult>;
  deleteFrom<TR extends keyof DB & string>(
    from: TR,
  ): DeleteQueryBuilder<DB, ExtractTableAlias<DB, TR>, DeleteResult>;
  deleteFrom<TR extends TableReference<DB>>(
    table: TR,
  ): DeleteQueryBuilder<From<DB, TR>, FromTables<DB, never, TR>, DeleteResult>;
  deleteFrom(table) {
    return this.context().deleteFrom(table);
  }

  updateTable<TR extends keyof DB & string>(
    table: TR,
  ): UpdateQueryBuilder<
    DB,
    ExtractTableAlias<DB, TR>,
    ExtractTableAlias<DB, TR>,
    UpdateResult
  >;
  updateTable<TR extends AnyAliasedTable<DB>>(
    table: TR,
  ): UpdateQueryBuilder<
    DB & PickTableWithAlias<DB, TR>,
    ExtractTableAlias<DB & PickTableWithAlias<DB, TR>, TR>,
    ExtractTableAlias<DB & PickTableWithAlias<DB, TR>, TR>,
    UpdateResult
  >;
  updateTable<TR extends TableReference<DB>>(
    table: TR,
  ): UpdateQueryBuilder<
    From<DB, TR>,
    FromTables<DB, never, TR>,
    FromTables<DB, never, TR>,
    UpdateResult
  >;
  updateTable(table) {
    return this.context().updateTable(table);
  }

  mergeInto<TR extends keyof DB & string>(
    targetTable: TR,
  ): MergeQueryBuilder<DB, TR, MergeResult>;
  mergeInto<TR extends AnyAliasedTable<DB>>(
    targetTable: TR,
  ): MergeQueryBuilder<
    DB & PickTableWithAlias<DB, TR>,
    ExtractTableAlias<DB & PickTableWithAlias<DB, TR>, TR>,
    MergeResult
  >;
  mergeInto(targetTable: any) {
    return this.context().mergeInto(targetTable) as any;
  }

  with(
    nameOrBuilder: string | CTEBuilderCallback<string>,
    expression: CommonTableExpression<DB, string>,
  ) {
    return this.context().with(nameOrBuilder, expression);
  }

  withRecursive(
    nameOrBuilder: string | CTEBuilderCallback<string>,
    expression: RecursiveCommonTableExpression<DB, string>,
  ) {
    return this.context().withRecursive(nameOrBuilder, expression);
  }

  withPlugin(plugin: KyselyPlugin) {
    return this.context().withPlugin(plugin);
  }

  withoutPlugins() {
    return this.context().withoutPlugins();
  }

  withSchema(schema: string) {
    return this.context().withSchema(schema);
  }

  private context() {
    return this.trx ?? this.db;
  }

  isTransaction() {
    return this.trx !== null;
  }

  startTransaction<T>(callback: (trx: Transaction<DB>) => Promise<T>) {
    return this.db.transaction().execute(async (trx) => {
      try {
        this.trx = trx;
        return await callback(this.trx);
      } catch (err) {
        throw err;
      } finally {
        this.trx = null;
      }
    });
  }
}
