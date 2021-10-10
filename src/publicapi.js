// The publicly exposed MathQuill API.

const API = {}, EMBEDS = {};

// globally exported API object
class MathQuill {
	static origMathQuill = window.MathQuill;
	static VERSION = "{VERSION}";

	static getInterface() {
		const APIClasses = {};

		// Function that takes an HTML element and, if it's the root HTML element of a
		// static math or math or text field, returns an API object for it (else, null).
		//   const mathfield = MQ.MathField(mathFieldSpan);
		//   assert(MQ(mathFieldSpan).id === mathfield.id);
		//   assert(MQ(mathFieldSpan).id === MQ(mathFieldSpan).id);
		function MQ(el) {
			if (!(el instanceof HTMLElement)) return null;
			const blockId = $(el).children('.mq-root-block').attr(mqBlockId);
			const ctrlr = blockId && Node.byId[blockId].controller;
			return ctrlr ? new APIClasses[ctrlr.KIND_OF_MQ](ctrlr) : null;
		};

		MQ.L = L;
		MQ.R = R;
		MQ.saneKeyboardEvents = saneKeyboardEvents;

		const config = (currentOptions, newOptions) => {
			if (newOptions && newOptions.handlers) {
				newOptions.handlers = { fns: newOptions.handlers, APIClasses };
			}
			for (const name in newOptions) {
				if (newOptions.hasOwnProperty(name)) {
					currentOptions[name] = newOptions[name];
				}
			}
		};

		MQ.config = (opts) => { config(Options.prototype, opts); return MQ; };

		MQ.registerEmbed = (name, options) => {
			if (!/^[a-z][a-z0-9]*$/i.test(name)) {
				throw 'Embed name must start with letter and be only letters and digits';
			}
			EMBEDS[name] = options;
		};

		APIClasses.AbstractMathQuill = class extends MathQuill {
			constructor(ctrlr) {
				super();

				this.__controller = ctrlr;
				this.__options = ctrlr.options;
				this.id = ctrlr.id;
				this.data = ctrlr.data;
			}

			__mathquillify(classNames) {
				const ctrlr = this.__controller, root = ctrlr.root, el = ctrlr.container;
				ctrlr.createTextarea();

				const contents = el.addClass(classNames).contents().detach();
				root.jQ =
					$('<span class="mq-root-block"/>').attr(mqBlockId, root.id).appendTo(el);
				this.latex(contents.text());

				this.revert = () => el.empty().off()
					.removeClass('mq-editable-field mq-math-mode mq-text-mode')
					.append(contents);
			}

			config(opts) { config(this.__options, opts); return this; }

			el() { return this.__controller.container[0]; }

			text() { return this.__controller.exportText(); }

			latex(latex) {
				if (arguments.length > 0) {
					this.__controller.renderLatexMath(latex);
					if (this.__controller.blurred) this.__controller.cursor.hide().parent.blur();
					return this;
				}
				return this.__controller.exportLatex();
			}

			html() {
				return this.__controller.root.jQ.html()
					.replace(/ mathquill-(?:command|block)-id="?\d+"?/g, '')
					.replace(/<span class="?mq-cursor( mq-blink)?"?>.?<\/span>/i, '')
					.replace(/ mq-hasCursor|mq-hasCursor ?/, '')
					.replace(/ class=(""|(?= |>))/g, '');
			}

			reflow() {
				this.__controller.root.postOrder('reflow');
				return this;
			}
		};
		MQ.prototype = APIClasses.AbstractMathQuill.prototype;

		APIClasses.EditableField = class extends APIClasses.AbstractMathQuill {
			__mathquillify(...args) {
				super.__mathquillify(...args);
				this.__controller.editable = true;
				this.__controller.delegateMouseEvents();
				this.__controller.editablesTextareaEvents();
				return this;
			}

			focus() { this.__controller.textarea.focus(); return this; }

			blur() { this.__controller.textarea.blur(); return this; }

			write(latex) {
				this.__controller.writeLatex(latex);
				this.__controller.scrollHoriz();
				if (this.__controller.blurred) this.__controller.cursor.hide().parent.blur();
				return this;
			}

			empty() {
				const root = this.__controller.root, cursor = this.__controller.cursor;
				root.eachChild('postOrder', 'dispose');
				root.ends[L] = root.ends[R] = 0;
				root.jQ.empty();
				delete cursor.selection;
				cursor.insAtRightEnd(root);
				return this;
			}

			cmd(cmd) {
				const ctrlr = this.__controller.notify(), cursor = ctrlr.cursor;
				if (/^\\[a-z]+$/i.test(cmd) && !cursor.isTooDeep()) {
					cmd = cmd.slice(1);
					const klass = LatexCmds[cmd];
					if (klass) {
						cmd = new klass(cmd);
						if (cursor.selection) cmd.replaces(cursor.replaceSelection());
						cmd.createLeftOf(cursor.show());
						this.__controller.scrollHoriz();
					} else {
						// TODO: API needs better error reporting
					}
				}
				else cursor.parent.write(cursor, cmd);
				if (ctrlr.blurred) cursor.hide().parent.blur();
				return this;
			}

			select() {
				const ctrlr = this.__controller;
				ctrlr.notify('move').cursor.insAtRightEnd(ctrlr.root);
				while (ctrlr.cursor[L]) ctrlr.selectLeft();
				return this;
			}

			clearSelection() {
				this.__controller.cursor.clearSelection();
				return this;
			}

			moveToDirEnd(dir) {
				this.__controller.notify('move').cursor.insAtDirEnd(dir, this.__controller.root);
				return this;
			}
			moveToLeftEnd() { return this.moveToDirEnd(L); }
			moveToRightEnd() { return this.moveToDirEnd(R); }

			keystroke(keys) {
				const keyList = keys.replace(/^\s+|\s+$/g, '').split(/\s+/);
				for (const key of keyList) {
					this.__controller.keystroke(key, { preventDefault: noop });
				}
				return this;
			}

			typedText(text) {
				for (const char of text) {
					this.__controller.typedText(char);
				}
				return this;
			}

			dropEmbedded(pageX, pageY, options) {
				const el = document.elementFromPoint(pageX - $(window).scrollLeft(), pageY - $(window).scrollTop());
				this.__controller.seek($(el), pageX, pageY);
				const cmd = new Embed().setOptions(options);
				cmd.createLeftOf(this.__controller.cursor);
			}

			clickAt(clientX, clientY, target) {
				target = target || document.elementFromPoint(clientX, clientY);

				const ctrlr = this.__controller, root = ctrlr.root;
				if (!jQuery.contains(root.jQ[0], target)) target = root.jQ[0];
				ctrlr.seek($(target), clientX + window.pageXOffset, clientY + window.pageYOffset);
				if (ctrlr.blurred) this.focus();
				return this;
			}

			ignoreNextMousedown(fn) {
				this.__controller.cursor.options.ignoreNextMousedown = fn;
				return this;
			}
		};
		MQ.EditableField = function() { throw "Don't call me, I'm 'abstract'."; };
		MQ.EditableField.prototype = APIClasses.EditableField.prototype;

		// Export the API functions that MathQuill-ify an HTML element into API objects
		// of each class. If the element had already been MathQuill-ified but into a
		// different kind (or it's not an HTML element), return null.
		for (const [kind, defAPIClass] of Object.entries(API)) {
			APIClasses[kind] = defAPIClass(APIClasses);
			MQ[kind] = function(el, opts) {
				const mq = MQ(el);
				if (mq instanceof APIClasses[kind] || !(el instanceof HTMLElement)) return mq;
				const ctrlr = new Controller(new APIClasses[kind].RootBlock, $(el), new Options);
				ctrlr.KIND_OF_MQ = kind;
				return new APIClasses[kind](ctrlr).__mathquillify(opts);
			};
			MQ[kind].prototype = APIClasses[kind].prototype;
		}

		return MQ;
	}

	static noConflict() {
		window.MathQuill = this.origMathQuill;
		return MathQuill;
	}
}

window.MathQuill = MathQuill;
