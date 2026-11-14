/**
 * Custom-element submit buttons (tr-button) call `form.requestSubmit()` without a submitter,
 * because a form-associated custom element cannot be one. They record themselves here for the
 * duration of that synchronous call, so a `submit` listener (tr-dialog's method="dialog"
 * handling) can still find the button and its value.
 */
const submitters = new WeakMap<HTMLFormElement, HTMLElement & { value: string }>();

/** Submits `form` on behalf of `button`, which `pendingSubmitter(form)` reports meanwhile. */
export function submitFor(form: HTMLFormElement, button: HTMLElement & { value: string }): void {
  submitters.set(form, button);
  try {
    form.requestSubmit();
  } finally {
    submitters.delete(form);
  }
}

/** The custom-element submitter of a submit that is being dispatched for `form`, if any. */
export function pendingSubmitter(form: HTMLFormElement): (HTMLElement & { value: string }) | undefined {
  return submitters.get(form);
}
