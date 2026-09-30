'use client'

type DeleteConfirmButtonProps = {
  action: (formData: FormData) => unknown
  label: string
  confirmText?: string
  className?: string
}

export default function DeleteConfirmButton({
  action,
  label,
  confirmText = 'Delete this item?',
  className,
}: DeleteConfirmButtonProps) {
  return (
    <form
      // Form actions may return a result object; React ignores the return value.
      action={action as (formData: FormData) => void | Promise<void>}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) {
          event.preventDefault()
        }
      }}
    >
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  )
}
