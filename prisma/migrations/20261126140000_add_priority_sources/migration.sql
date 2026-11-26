-- Formas de conhecimento usadas no bloco de prioridades do painel de Captação
-- (INDICAÇÃO / FACHADA / LIGAÇÃO), conforme a tela da cliente.
INSERT INTO "lead_sources" ("id", "description", "noCommission", "active", "createdAt", "updatedAt") VALUES
('fonte_fachada', 'Fachada', false, true, NOW(), NOW()),
('fonte_ligacao', 'Ligação', false, true, NOW(), NOW())
ON CONFLICT ("description") DO NOTHING;
