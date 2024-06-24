#!/usr/bin/env node

import { program } from "commander";
import inquirer from "inquirer";
import shell from "shelljs";
import fs from "fs-extra";
import path from "path";
import simpleGit from "simple-git";
import chalk from "chalk";
import figlet from "figlet";
import AdmZip from "adm-zip";
import ora from "ora";
import { fileURLToPath } from "url";
import { dirname } from "path";

const git = simpleGit();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

program
    .version("1.0.0")
    .description("CLI para crear proyectos con la plantilla ISI.INVOICE");

const showBanner = () => {
    console.log(
        chalk.blue(
            figlet.textSync("ISI INVOICE", {
                horizontalLayout: "default",
                verticalLayout: "default",
            })
        )
    );
};

const handleZipEntry = (entry, projectPath, zip) => {
    const entryPath = path.join(projectPath, entry.entryName);
    if (entry.isDirectory) {
        fs.ensureDirSync(entryPath);
        console.log(
            chalk.green(`📁 Directorio creado/actualizado: ${entry.entryName}`)
        );
    } else {
        fs.ensureFileSync(entryPath);
        fs.writeFileSync(entryPath, zip.readFile(entry));
        console.log(
            chalk.green(`📄 Archivo creado/actualizado: ${entry.entryName}`)
        );
    }
};

const copyDirectory = (source, destination) => {
    fs.copySync(source, destination, {
        overwrite: false,
        errorOnExist: false,
        filter: (src) => {
            const relativePath = path.relative(source, src);
            return (
                !relativePath.startsWith("node_modules") &&
                !relativePath.startsWith(".git")
            );
        },
    });
};

program
    .command("create <projectName>")
    .description("Crea un nuevo proyecto con la plantilla ISI.INVOICE")
    .action(async (projectName) => {
        showBanner();

        const { packageManager } = await inquirer.prompt([
            {
                type: "list",
                name: "packageManager",
                message: "¿Qué gestor de paquetes quieres usar?",
                choices: ["npm", "yarn", "pnpm"],
            },
        ]);

        const answers = await inquirer.prompt([
            {
                type: "input",
                name: "repo",
                message: "URL del repositorio remoto:",
            },
            {
                type: "input",
                name: "isi_documento_sector",
                message: "Documento sector (ISI_DOCUMENTO_SECTOR):",
            },
            {
                type: "input",
                name: "isi_api_url",
                message: "URL de la API (ISI_API_URL):",
            },
            {
                type: "input",
                name: "app_env",
                message: "Entorno de la aplicación (APP_ENV):",
                default: "local",
            },
        ]);

        const projectPath = path.join(process.cwd(), projectName);
        if (fs.existsSync(projectPath)) {
            console.log(
                chalk.yellow(
                    `⚠️  El directorio ${projectName} ya existe. Por favor, elija otro nombre o elimine el directorio existente.`
                )
            );
            return;
        }
        fs.ensureDirSync(projectPath);
        shell.cd(projectPath);

        console.log(chalk.green("🔧 Inicializando el repositorio Git..."));
        await git.init();

        try {
            const remotes = await git.getRemotes();
            if (remotes.find((remote) => remote.name === "origin")) {
                await git.removeRemote("origin");
            }
            await git.addRemote("origin", answers.repo);
            console.log(
                chalk.green("🌐 Repositorio remoto añadido exitosamente.")
            );
        } catch (error) {
            console.log(
                chalk.yellow(
                    "⚠️  No se pudo añadir el repositorio remoto. Error: " +
                        error.message
                )
            );
        }

        console.log(
            chalk.green("📥 Clonando el repositorio de la plantilla...")
        );
        const tempPath = path.join(__dirname, "temp");
        fs.ensureDirSync(tempPath);
        try {
            await git.clone(
                "https://github.com/integrate-bolivia/isi-template.git",
                tempPath,
                ["--branch", "main"]
            );
            console.log(
                chalk.green(
                    "📦 Repositorio de la plantilla clonado exitosamente."
                )
            );
        } catch (error) {
            console.log(
                chalk.yellow(
                    "⚠️  No se pudo clonar el repositorio de la plantilla. Error: " +
                        error.message
                )
            );
            return;
        }

        console.log(chalk.green("📁 Copiando estructura del proyecto..."));
        copyDirectory(tempPath, projectPath);

        console.log(chalk.green("📦 Extrayendo isiTemplate.zip..."));
        const zipPath = path.join(tempPath, "isiTemplate.zip");
        if (fs.existsSync(zipPath)) {
            const zip = new AdmZip(zipPath);
            const zipEntries = zip.getEntries();

            zipEntries.forEach((entry) =>
                handleZipEntry(entry, projectPath, zip)
            );

            console.log(
                chalk.green("📦 Extracción de isiTemplate.zip completada.")
            );
        } else {
            console.log(
                chalk.yellow(
                    "⚠️  Archivo isiTemplate.zip no encontrado en el repositorio clonado."
                )
            );
        }

        fs.removeSync(tempPath);

        console.log(
            chalk.green("📝 Modificando archivos .env y .env.production...")
        );

        const envContent = `APP_ENV=${answers.app_env}
ISI_BASE_URL=http://localhost:3002
ISI_API_URL=${answers.isi_api_url}
ISI_DOCUMENTO_SECTOR=${answers.isi_documento_sector}
ISI_CAPTCHA_KEY=0x4AAAAAAAIR3qJWMFMaFVXX
ISI_ASSETS_URL=/assets/images/integrate
ISI_FONDO=/assets/images/integrate/fondo-login.jpg
ISI_LOGO_FULL=/assets/images/integrate/logo.png
ISI_LOGO_MINI=/assets/images/integrate/logo-mini.png
ISI_NOMBRE_COMERCIAL=ISI.INVOICE
ISI_URL=https://integrate.com.bo
ISI_FAVICON=/assets/images/integrate/favicon.ico
ISI_THEME=blue
`;
        fs.writeFileSync(path.join(projectPath, ".env"), envContent);

        const envProdContent = `APP_ENV=production
ISI_BASE_URL=dev.adm.isipass.com.bo
ISI_API_URL=https://sandbox.isipass.net/api
ISI_ASSETS_URL=/assets/integrate
ISI_FONDO=/assets/integrate/fondo-login.jpg
ISI_LOGO_FULL=/assets/integrate/logo.png
ISI_LOGO_MINI=/assets/integrate/logo-mini.png
ISI_NOMBRE_COMERCIAL=ISI.INVOICE
ISI_URL=https://integrate.com.bo
ISI_FAVICON=/assets/integrate/favicon.ico
ISI_THEME=blue1
ISI_DOCUMENTO_SECTOR=${answers.isi_documento_sector}
ISI_CAPTCHA_KEY=0x4AAAAAAAIR3qJWMFMaFVXX
`;
        fs.writeFileSync(
            path.join(projectPath, ".env.production"),
            envProdContent
        );

        console.log(chalk.green("📝 Modificando index.html..."));
        const indexPath = path.join(projectPath, "index.html");
        if (fs.existsSync(indexPath)) {
            let indexContent = fs.readFileSync(indexPath, "utf-8");
            indexContent = indexContent.replace(
                /<meta name="description" content="[^"]*"/,
                `<meta name="description" content="${projectName}"`
            );
            indexContent = indexContent.replace(
                /<title>[^<]*<\/title>/,
                `<title>${projectName}</title>`
            );
            fs.writeFileSync(indexPath, indexContent);
        }

        console.log(chalk.green("📝 Modificando Layout1.tsx..."));
        const layoutPath = path.join(
            projectPath,
            "src/app/base/components/Template/MatxLayout/Layout1/Layout1.tsx"
        );
        if (fs.existsSync(layoutPath)) {
            let layoutContent = fs.readFileSync(layoutPath, "utf-8");
            if (!layoutContent.includes("<LayoutRestriccion />")) {
                layoutContent = layoutContent.replace(
                    /(return \(\s*<div)/,
                    "return (\n<LayoutRestriccion />\n<div"
                );
                fs.writeFileSync(layoutPath, layoutContent);
            }
        }

        fs.ensureDirSync(path.join(projectPath, "dist-zip"));

        console.log(chalk.green("🧹 Eliminando archivos innecesarios..."));
        const mdFiles = fs
            .readdirSync(projectPath)
            .filter((file) => file.endsWith(".md"));
        mdFiles.forEach((file) => fs.removeSync(path.join(projectPath, file)));

        const readmeContent = `# ${projectName}

Este proyecto ha sido generado utilizando la plantilla ISI.INVOICE.

## Configuración

Asegúrese de actualizar los siguientes archivos con la configuración correcta:

- .env
- .env.production

## Scripts disponibles

### Desarrollo

\`\`\`
${packageManager} run dev
\`\`\`

### Producción

\`\`\`
${packageManager} run build
\`\`\`

### Otros comandos

Asegúrese de revisar los scripts adicionales en el archivo \`package.json\`.
`;

        fs.writeFileSync(path.join(projectPath, "README.md"), readmeContent);

        console.log(
            chalk.green(`📂 Proyecto ${projectName} creado exitosamente.`)
        );

        console.log(chalk.green("🚀 Instalando dependencias..."));
        const spinner = ora({
            text: "Instalando dependencias...",
            spinner: "dots",
        }).start();

        shell.cd(projectPath);

        try {
            let installCommand;
            if (packageManager === "npm") {
                installCommand = "npm install --loglevel=warn";
            } else if (packageManager === "yarn") {
                installCommand = "yarn install --silent";
            } else if (packageManager === "pnpm") {
                installCommand = "pnpm install --reporter=silent";
            }

            const result = shell.exec(installCommand, { silent: true });

            if (result.code !== 0) {
                spinner.fail("Error durante la instalación de dependencias.");
                console.log(result.stderr);
                return;
            }

            spinner.succeed("Dependencias instaladas exitosamente.");
        } catch (error) {
            spinner.fail("Error durante la instalación de dependencias.");
            console.error(error);
            return;
        }

        console.log(chalk.green("📂 Abriendo la carpeta del proyecto..."));
        shell.exec(`code .`); // Este comando abre VSCode en la carpeta del proyecto. Puedes cambiarlo según el editor de tu preferencia.

        console.log(chalk.green("🚀 Iniciando el servidor de desarrollo..."));
        if (packageManager === "npm") {
            shell.exec("npm run dev");
        } else if (packageManager === "yarn") {
            shell.exec("yarn dev");
        } else if (packageManager === "pnpm") {
            shell.exec("pnpm dev");
        }
    });

program.parse(process.argv);
