import type { FastifyInstance } from 'fastify'
import { PostgresMeta } from '../../../lib'
import { DEFAULT_POOL_CONFIG } from '../../constants'
import { extractRequestForLogging } from '../../utils'
import { apply as applyTypescriptTemplate } from '../../templates/typescript'

export default async (fastify: FastifyInstance) => {
  fastify.get<{
    Headers: { pg: string }
    Querystring: {
      excluded_schemas?: string
    }
  }>('/', async (request, reply) => {
    const connectionString = request.headers.pg
    const excludedSchemas =
      request.query.excluded_schemas?.split(',').map((schema) => schema.trim()) ?? []

    const pgMeta: PostgresMeta = new PostgresMeta({ ...DEFAULT_POOL_CONFIG, connectionString })
    const { data: schemas, error: schemasError } = await pgMeta.schemas.list()
    const { data: tables, error: tablesError } = await pgMeta.tables.list()
    const { data: functions, error: functionsError } = await pgMeta.functions.list()
    const { data: types, error: typesError } = await pgMeta.types.list({
      includeSystemSchemas: true,
    })
    await pgMeta.end()

    if (schemasError) {
      request.log.error({ error: schemasError, request: extractRequestForLogging(request) })
      reply.code(500)
      return { error: schemasError.message }
    }
    if (tablesError) {
      request.log.error({ error: tablesError, request: extractRequestForLogging(request) })
      reply.code(500)
      return { error: tablesError.message }
    }
    if (functionsError) {
      request.log.error({ error: functionsError, request: extractRequestForLogging(request) })
      reply.code(500)
      return { error: functionsError.message }
    }
    if (typesError) {
      request.log.error({ error: typesError, request: extractRequestForLogging(request) })
      reply.code(500)
      return { error: typesError.message }
    }

    return applyTypescriptTemplate({
      schemas: schemas.filter(({ name }) => !excludedSchemas.includes(name)),
      tables,
      functions,
      types,
    })
  })
}
