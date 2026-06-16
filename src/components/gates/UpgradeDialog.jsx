import { Modal } from '@/components/ui/Modal'
import { UpgradeCard } from './UpgradeCard'

export function UpgradeDialog({ open, onClose, feature, currentTier, target }) {
  return (
    <Modal open={open} onClose={onClose} title="Upgrade required" size="md">
      <UpgradeCard feature={feature} currentTier={currentTier} target={target} onDismiss={onClose} />
    </Modal>
  )
}
