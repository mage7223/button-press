# button-press

Web app for turning uploaded photos into print-ready sheets of circular
artwork sized for a pin-back button press. See [`SPEC.md`](./SPEC.md) for
the full product and technical spec.

Built with Angular + TypeScript. Deploys to S3 + CloudFront via the
GitHub Actions workflows in [`.github/workflows/`](./.github/workflows) —
see `SPEC.md` §15 for the full CI/CD design and provisioned AWS resources.

## Development server

To start a local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to
`http://localhost:4200/`. The application will automatically reload
whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new
component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`,
`directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
npm run build
```

This compiles the project and stores the build artifacts in the `dist/`
directory, optimized for production by default.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner,
use the following command:

```bash
npm test
```

## Additional Resources

For more information on using the Angular CLI, including detailed command
references, visit the
[Angular CLI Overview and Command Reference](https://angular.dev/tools/cli)
page.
