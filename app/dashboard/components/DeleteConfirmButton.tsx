'use client'

type DeleteConfirmButtonProps = {
  action: (formData: FormData) => Promise<any> | any
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
      action={action}
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
