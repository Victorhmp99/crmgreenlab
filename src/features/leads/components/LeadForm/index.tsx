import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LeadFormFields } from './LeadFormFields'
import type { Lead } from '@/types'

interface LeadFormProps {
  open:          boolean
  onClose:       () => void
  lead?:         Lead | null
  pipelineName?: string
}

export function LeadForm({ open, onClose, lead }: LeadFormProps) {
  const isEditing = !!lead
  const [submitting, setSubmitting] = useState(false)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar Lead' : 'Novo Lead'}
      description={isEditing ? `Editando ${lead?.name}` : 'Preencha os dados do novo lead'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button form="lead-form" type="submit" loading={submitting}>
            {isEditing ? 'Salvar alterações' : 'Criar lead'}
          </Button>
        </>
      }
    >
      <LeadFormFields
        formId="lead-form"
        open={open}
        lead={lead}
        onDone={onClose}
        onSubmittingChange={setSubmitting}
      />
    </Modal>
  )
}
