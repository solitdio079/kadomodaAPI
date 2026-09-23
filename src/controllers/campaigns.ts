import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { campaignFields, campaignPatch } from '../validation/commerce.js';
import { validate, idParam, notFound } from '../middleware/http.js';
export const validateCampaign = validate(campaignFields);
export const validateCampaignPatch = validate(campaignPatch);
export async function createCampaign(req: Request, res: Response) { res.status(201).json({ data: await prisma.campaign.create({ data: { ...campaignFields.parse(req.body), image: req.file?.filename } }) }); }
export async function putCampaign(req: Request, res: Response) { res.json({ data: await prisma.campaign.update({ where: { id: idParam(req.params.campaignId) }, data: { ...campaignFields.parse(req.body), ...(req.file ? { image: req.file.filename } : {}) } }) }); }
export async function patchCampaign(req: Request, res: Response) { res.json({ data: await prisma.campaign.update({ where: { id: idParam(req.params.campaignId) }, data: { ...campaignPatch.parse(req.body), ...(req.file ? { image: req.file.filename } : {}) } }) }); }
export async function getOneCampaign(req: Request, res: Response) { const data = await prisma.campaign.findUnique({ where: { id: idParam(req.params.campaignId) } }); if (!data) notFound(); res.json({ data }); }
export async function getAllCampaign(_req: Request, res: Response) { res.json({ data: await prisma.campaign.findMany({ orderBy: { id: 'desc' } }) }); }
export async function deleteCampaign(req: Request, res: Response) { await prisma.campaign.delete({ where: { id: idParam(req.params.campaignId) } }); res.json({ message: 'Kampanya silindi.' }); }
