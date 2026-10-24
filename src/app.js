import express from 'express';
import { PrismaClient } from '@prisma/client';

/**
 * @typedef {import('./config.js').AppConfig} AppConfig
 * @typedef {object} AppComponents
 * @property {import('express').Express} app
 * @property {PrismaClient} prisma
 */

/**
 * @param {AppConfig} config
 * @returns {AppComponents}
 */
export const createApp = (config) => {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: config.databaseUrl },
    },
  });

  return {
    app: express(),
    prisma,
  };
};
