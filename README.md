This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.



1. Debemos tener en el admin como ver todos los participantes, se sube el archivo pero no muestra el listado y poder editarlos en caso de querer cambiar algo a algun participante
2. Al igual que participantes debemos mostrar las ponencias y poder editarlas en caso que queramos cambiarle algo , por ejemplo cambiar la fecha. 
3. La busqueda manual de participantes debe poder realizarse por cualquier campo, no solo por el correo, si ya obtenemos todos los datos pues usemos todo. El correo es solo para id unico de verificación cuando escaneamos el qr.
4. al escanear un qr muestra la información del participante pero aparte de tener un boton para volver a escanear deberiamos automaticamente ocultar los datos de esa persona y abrir el escaner para agilizar. 
5. cuando presionemos lector qr que no tengamos que presionar request camera permision, debemos agilizar y mejor la experiencia de usuario, que al presionar lector qr inmediatamente abra la camara o pregunte inmediatamente request permision sin tener que presionar otro boton. 
6. Que pasó con poder ver todos los participantes a los que se les ha hecho check in?
7. que pasó con la visual de ver que datos hay que sincronizar por falta de internet?
8. es posible que apenas subimos el archivo excel de participantes, que a los que tienen rol de Moderador queden activos para evaluar todos los días sin tener que checkarlos diariamente? solo a ese rol, lo que tienen rol de participante si deben checkquearse a diario.
9. al subir el archivo de ponencias deberia hacer lo mismo que el participantes, omitir las columnas que no son necesarias y utilizar las necesarias de manera inteligente y sin tener que poner en orden las columnas. El nombre de las columnas del archivo a usar son: ID envío, Título, Fecha. La fecha esta configurada como DD/MM/YYYY. 
10. deberiamos tener un admin master, que es quien debe ver todo lo del admin actual, y usuarios admin que solo podran ver o utilizar los modulos que el master le habilite, entonces el master debe poder crear usuarios desde su panel. 
11. dado que este sistema no solo sera para ponencias, debemos modular para que sera el ingreso, es decir desde el panel admin seleccionar Ponencias, e ingresar a todo lo que conlleva ponencias que es lo que hemos hecho hasta ahora. pero después vamos a tener ingreso para Fiesta, Almuerzo, Cena, Entonces el master debe poder crear todos los modulos que quiera con su nombre y obviamente poder cargarle los usuarios y todo eso, claro que el resto de modulos o eventos no tendran las mismas tablas de datos, solo seran algo como escanear el qr para activarlo y saber si ya ingresó a la fiesta y que no utilicen un qr duplicadamente, que un usuario no ingrese duplicadamente a cada uno de los otros modulos o eventos que se vayan a crear. A esos modulos por ahora cada vez que se cree uno solo es para que el o los admins puedan escanear los qr, el master se encarga de subir el arcvivo excel. Me hago entender?
12. Aparte que sucedió con mostrar en tiempo real los datos de evaluaciones, quienes han evaluado, que ponencias, mostrar los datos completos con las formulas y todo eso? Quedamos que se podía ver en tiempo real todo lo que iba pasando y también que se podía descargar el archivo excel con la información. 