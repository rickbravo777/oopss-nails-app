# Guía rápida — reunión con cliente 2026-08-11

## Requisito

Lleva ESTA laptop. La base de datos (PostgreSQL) y el proyecto están instalados
localmente aquí — no hay nada en internet todavía. Solo necesitas WiFi/datos
para que el chat pueda hablar con OpenAI.

## 1. Arrancar los dos servidores

Abre dos ventanas de terminal (PowerShell o CMD):

**Terminal 1 — Backend:**
```
cd "C:\Users\rbrav\Documents\Proyectos Claude\salon_belleza\FactorIA-APP-TEMPLATE-v2\backend"
npm run dev
```
Espera a ver: `Oopss Nails backend listening on port 3000`

**Terminal 2 — Frontend:**
```
cd "C:\Users\rbrav\Documents\Proyectos Claude\salon_belleza\FactorIA-APP-TEMPLATE-v2\frontend"
npm run dev -- --host
```
Espera a ver: `Local: http://localhost:5173/`

No necesitas arrancar PostgreSQL a mano — está configurado para iniciar
automáticamente con Windows.

## 2. Abrir la app

- **Chat del cliente (lo que ve el público)**: http://localhost:5173
- **Panel de administración**: http://localhost:5173/admin/login

## 3. Credenciales del panel admin (solo para pruebas/demo)

- Usuario: `admin@oopssnails.local`
- Contraseña: `DevOnly_ChangeMe123`

## 4. Si algo no responde

- Revisa que las dos terminales sigan abiertas y sin errores en rojo.
- Si el chat no contesta, revisa que haya internet (el chat necesita
  llegar a OpenAI).
- Si necesitas reiniciar todo: cierra ambas terminales (Ctrl+C) y vuelve
  a correr los dos comandos del paso 1.

## 5. Si el cliente quiere probarlo desde SU propio celular/computadora

No va a funcionar con este montaje local — necesitaría estar en la misma
red WiFi que tu laptop, y aun así puede fallar por firewall. Lo correcto
es terminar el despliegue a EasyPanel (pendiente, ver
`docs/project_memory.md`) para tener una URL real de internet. Si esto
surge mañana, avísame para retomarlo.
