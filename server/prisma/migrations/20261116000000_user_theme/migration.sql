-- Estilo visual elegido por cada usuario en su perfil.
CREATE TYPE "UiTheme" AS ENUM ('COMIC', 'RETRO');

ALTER TABLE "User" ADD COLUMN "theme" "UiTheme" NOT NULL DEFAULT 'COMIC';
