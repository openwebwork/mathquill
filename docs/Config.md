# Setting Configuration

The configuration options object is of the following form:

```js
{
    enableSpaceNavigation: true,
    leftRightIntoCmdGoes: 'up',
    restrictMismatchedBrackets: true,
    sumStartsWithNEquals: true,
    supSubsRequireOperand: true,
    charsThatBreakOutOfSupSub: '+-=<>',
    autoSubscriptNumerals: true,
    autoCommands: 'pi theta sqrt sum',
    autoOperatorNames: 'sin cos',
    maxDepth: 10,
    substituteTextarea: function() {
      return document.createElement('textarea');
    },
    handlers: {
      edit: (mathField) => { ... },
      upOutOf: (mathField) => { ... },
      moveOutOf: (dir, mathField) => { if (dir === MQ.L) ... else ... }
    }
}
```

You can configure an editable math field by passing an options argument as the second argument to
[the constructor (`MQ.MathField(html_element, config)`)](Api_Methods.md#mqmathfieldhtml_element-config), or by
[calling `.config()` on the math field (`mathField.config(new_config)`)](Api_Methods.md#confignew_config).

Global defaults may be set with [`MQ.config(global_config)`](Api_Methods.md#mqconfigconfig).

## Configuration Options

The following configuration options are available.

### enableSpaceNavigation

If `enableSpaceNavigation` is true the keystrokes `{Shift-,}Spacebar` will behave like `{Shift-,}Escape` escaping from
the current block (as opposed to the default behavior of inserting a Space character).

### leftRightIntoCmdGoes

This allows you to change the way the left and right keys move the cursor when there are items of different height, like
fractions.

By default, the Left and Right keys move the cursor through all possible cursor positions in a particular order: right
into a fraction puts the cursor at the left end of the numerator, right out of the numerator puts the cursor at the left
end of the denominator, and right out of the denominator puts the cursor to the right of the fraction. Symmetrically,
left into a fraction puts the cursor at the right end of the denominator, etc.

If instead you want right to always visually go right, and left to always go visually left, you can set
`leftRightIntoCmdGoes` to `'up'` or `'down'` so that left and right go up or down (respectively) into commands. For
example, `'up'` means that left into a fraction goes up into the numerator and right out of the numerator skips the
denominator and puts the cursor to the right of the fraction. If this property is set to `'down'` instead, the
numerator is harder to navigate to.

### restrictMismatchedBrackets

If `restrictMismatchedBrackets` is true then you can type `[a,b)` and `(a,b]`, but if you try typing `[x}` or
`\langle x|`, you'll get `[{x}]` or `\langle|x|\rangle` instead. This lets you type `(|x|+1)` normally; otherwise, you'd
get `\left( \right| x \left| + 1 \right)`.

### sumStartsWithNEquals

If `sumStartsWithNEquals` is true then when you type `\sum`, `\prod`, or `\coprod`, the lower limit starts out with
`n=`, e.g. you get the LaTeX `\sum_{n=}^{ }`, rather than empty by default.

### supSubsRequireOperand

`supSubsRequireOperand` disables typing of superscripts and subscripts when there's nothing to the left of the cursor to
be exponentiated or subscripted. Prevents the especially confusing typo `x^^2`, which looks much like `x^2`.

### charsThatBreakOutOfSupSub

`charsThatBreakOutOfSupSub` takes a string of the chars that when typed, "break out" of superscripts and subscripts.

Normally, to get out of a superscript or subscript, a user has to navigate out of it with the directional keys, a mouse
click, or Space if `enableSpaceNavigation` is true. For example, typing `x^2n+y` normally results in the LaTeX
`x^{2n+y}`. If you wanted to get the LaTeX `x^{2n}+y`, the user would have to manually move the cursor out of the
exponent.

If this option was set to `'+-'`, `+` and `-` would "break out" of the exponent. This doesn't apply to the first
character in a superscript or subscript, so typing `x^-6` still results in `x^{-6}`. The downside to setting this option
is that in order to type `x^{n+m}`, a workaround like typing `x^(n+m` and then deleting the `(` is required.

### autoCommands

`autoCommands` defines the set of commands automatically rendered by just typing the letters without typing a backslash
first.

This takes a string formatted as a space-delimited list of LaTeX commands. Each LaTeX command must be at least letters
only with a minimum length of 2 characters.

For example, with `autoCommands` set to `'pi theta'`, the word 'pi' automatically converts to the pi symbol and the word
'theta' automatically converts to the theta symbol.

### autoOperatorNames

`autoOperatorNames` overrides the set of operator names that automatically become non-italicized when typing the letters
without typing a backslash first, like `sin`, `log`, etc.

This defaults to the LaTeX built-in operator names ([Section 3.17 of the Short Math Guide](http://tinyurl.com/jm9okjc))
with additional trig operators like `sech`, `arcsec`, `arsinh`, etc. If you want some of these italicized after setting
this property, you will have to add them to the list.

Just like [`autoCommands`](#autocommands) above, this takes a string formatted as a space-delimited list of LaTeX
commands.

### maxDepth

`maxDepth` specifies the maximum number of nested MathBlocks. When `maxDepth` is set to 1, the user can type simple math
symbols directly into the editor but not into nested MathBlocks, e.g. the numerator and denominator of a fraction.

Nested content in latex rendered during initialization or pasted into mathquill is truncated to avoid violating
`maxDepth`. When `maxDepth` is not set, no depth limit is applied by default.

### substituteTextarea

`substituteTextarea` is a function that creates a focusable DOM element that is called when setting up a math field.
Overwriting this may be useful for hacks like suppressing built-in virtual keyboards. It defaults to
`<textarea autocorrect=off .../>`.

### mouseEvents

If `mouseEvents` is true then mouse events are active for static math fieds. This is true by default.

### autoSubscriptNumerals

If `autoSubscriptNumerals` is true then a number typed after a letter will automatically be put into a subscript.

### typingSlashWritesDivisionSymbol

If `typingSlashWritesDivisionSymbol` true then typing a slash gives the division symbol instead of a live fraction.

### typingAsteriskWritesTimesSymbol

If `typingAsteriskWritesTimesSymbol` is true then typing an asterisk gives the times symbol instead of a `\cdot`.

### rootsAreExponents

If `rootsAreExponents` is true, then the text output of an nth root will be `x^(1/n)`. Otherwise it will be `root(n,x)`.

### logsChangeBase

If `logsChangeBase` is true then the text output for the logarithm with base b of x will be `log(x)/log(b)`. Otherwise
the output will be `logb(b,x)`. Note that this option does not affect base 10 output. That is always `log10(x)`.

### tabbable

For static and editable math fields, when `tabbable` is false, the math field is not part of the page's tab order.
Despite that, the math field can still be focused when selected by a mouse.

Static math fields default to `tabbable: false`, Editable math fields default to `tabbable: true`.

### blurWithCursor

This is a method with the signature `(e: FocusEvent, mq?: AbstractMathQuill) => boolean`. If provided, this method will
be called anytime an editable math field loses focus (for example if the "Tab" key is pressed or the window loses
focus). If the method returns true, then the field will be blurred with the cursor left visible. This means that if
there is a selection in the field, it will not be cleared but will be given an inactive gray styling, and if there is
not a selection then the cursor will remain in the field but will stop blinking. This gives the appearance of no longer
being active but gives indicators as to where the cursor is. This is useful for implementing a toolbar.

## Handlers

Handlers are called after a specified event.

```js
const latex = '';
const mathField = MQ.MathField(document.getElementById('mathfield'), {
    handlers: {
        edit: () => {
            latex = mathField.latex();
        },
        enter: () => {
            submitLatex(latex);
        }
    }
});
```

### \*OutOf handlers

`.moveOutOf(direction, mathField)`, `.deleteOutOf(direction, mathField)`,
`.selectOutOf(direction, mathField)`, `.upOutOf(mathField)`, `.downOutOf(mathField)`

The `*OutOf` handlers are called when a cursor movement would cause the cursor to leave the MathQuill mathField. These
let you integrate cursor movement seamlessly between your code and MathQuill. For example, when the cursor is at the
right edge, pressing the Right key causes the `moveOutOf` handler to be called with `MQ.R` and the math field API
object. Pressing Backspace causes `deleteOutOf` to be called with `MQ.L` and the API object.

### enter(mathField)

Called whenever Enter is pressed.

### edit(mathField)

This is called when the contents of the field might have been changed. This will be called with any edit, such as
something being typed, deleted, or written with the API. Note that this may be called when nothing has actually changed.

### textBlockEnter(mathField)

This is called whenever a text block is started.

### textBlockExit(mathField)

This is called whenver a text block is ended.

## Changing Colors

To change the foreground color, set both `color` and the `border-color` because some MathQuill symbols are implemented
with borders instead of pure text.

For example, to style as white-on-black instead of black-on-white use:

```css
#my-math-input {
    color: white;
    border-color: white;
    background: black;
}

#my-math-input .mq-matrixed {
    background: black;
}

#my-math-input .mq-matrixed-container {
    filter: progid:DXImageTransform.Microsoft.Chroma(color='black');
}
```
