import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.flatten().fieldErrors,
    })
  }

  if (err instanceof Error) {
    console.error(err.message, err.stack)
    return res.status(500).json({ error: err.message })
  }

  return res.status(500).json({ error: 'Internal server error' })
}
