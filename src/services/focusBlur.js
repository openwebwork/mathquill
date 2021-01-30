Controller.open(function(_) {
  _.focusBlurEvents = function() {
    var ctrlr = this, root = ctrlr.root, cursor = ctrlr.cursor;
    ctrlr.textarea.focus(function() {
      ctrlr.blurred = false;
      ctrlr.container.addClass('mq-focused');
      if (!cursor.parent)
        cursor.insAtRightEnd(root);
      if (cursor.selection) {
        cursor.selection.jQ.removeClass('mq-blur');
        ctrlr.selectionChanged(); //re-select textarea contents after tabbing away and back
      }
      else
        cursor.show();
    }).blur(function() {
      ctrlr.blurred = true;
      ctrlr.container.removeClass('mq-focused');
      cursor.hide().parent.blur();
      if (cursor.selection) cursor.selection.jQ.addClass('mq-blur');
    });
    ctrlr.blurred = true;
    cursor.hide().parent.blur();
  };
  _.unbindFocusBlurEvents = function() {
    var ctrlr = this;
    ctrlr.textarea.unbind('focus blur');
  };
});

/**
 * TODO: I wanted to move MathBlock::focus and blur here, it would clean
 * up lots of stuff like, TextBlock::focus is set to MathBlock::focus
 * and TextBlock::blur calls MathBlock::blur, when instead they could
 * use inheritance and super_.
 *
 * Problem is, there's lots of calls to .focus()/.blur() on nodes
 * outside Controller::focusBlurEvents(), such as .postOrder('blur') on
 * insertion, which if MathBlock::blur becomes Node::blur, would add the
 * 'blur' CSS class to all Symbol's (because .isEmpty() is true for all
 * of them).
 *
 * I'm not even sure there aren't other troublesome calls to .focus() or
 * .blur(), so this is TODO for now.
 */
