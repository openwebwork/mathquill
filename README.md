# MathQuill

MathQuill is a web formula editor designed to make typing math easy and beautiful.

Originally written by [Han](https://github.com/laughinghan), [Jeanine](https://github.com/jneen), and
[Mary](https://github.com/stufflebear) (<maintainers@mathquill.com>).

This version of MathQuill is completely rewritten using TypeScript, is built with Webpack, and is intended for use with
the open-source online homework system [WeBWorK](https://github.com/openwebwork).

## Getting Started

MathQuill has a simple interface. This brief example creates a MathQuill element and renders, then reads a given input:

```js
const MQ = MathQuill.getInterface();

const htmlElement = document.getElementById('some_id');

const config = {
    handlers: { edit: () => { ... } },
    restrictMismatchedBrackets: true
};

const mathField = MQ.MathField(htmlElement, config);

mathField.latex('2^{\\frac{3}{2}}'); // Renders the given LaTeX in the MathQuill field
mathField.latex(); // => '2^{\\frac{3}{2}}'
```

## Docs

Check out the upstream [Getting Started Guide](http://docs.mathquill.com/en/latest/Getting_Started/) for setup
instructions and basic MathQuill usage.

Most documentation for MathQuill is located on [ReadTheDocs](http://docs.mathquill.com/en/latest/).

## Building MathQuill

To build mathquill, you will need a node.js installation. You can obtain it from [nodejs](http://nodejs.org/).

To build MathQuill run:

```bash
npm install
npm run build
```

The resulting MathQuill build will be located in the `dist` directory.

## Test Server

Additionally you can run `npm run serve` which will automatically re-build and serve the demo, unit tests, and visual
tests.

Then you can enter <http://localhost:9292/demo.html>, <http://localhost:9292/unit-test.html>,
<http://localhost:9292/visual-test.html>, <http://localhost:9292/input-test.html>,
<http://localhost:9292/basic-test.html>, or just <http://localhost:9292> in your browser to view the various available
pages.

## Open-Source License

The Source Code Form of MathQuill is subject to the terms of the Mozilla Public License, v. 2.0:
[http://mozilla.org/MPL/2.0/](http://mozilla.org/MPL/2.0/)

The quick-and-dirty is you can do whatever if modifications to MathQuill are in public GitHub forks. (Other ways to
publicize modifications are also fine, as are private use modifications. See also:
[MPL 2.0 FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/))
