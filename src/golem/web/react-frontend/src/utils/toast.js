// Toast store - simple global state
import { createLogger } from './logger'

const logger = createLogger('Toast');

let toastListener = null
let toastId = 0

export const showToast = (message, type = 'error') => {
  logger.debug('showToast called:', message, 'listener:', !!toastListener)
  if (toastListener) {
    toastListener({ id: ++toastId, message, type })
  } else {
    // every screen mounts <Toast/>; without it the message only goes to the log (no blocking alert)
    logger.warn('No toast listener:', message)
  }
}

export const setToastListener = (listener) => {
  logger.debug('Setting listener')
  toastListener = listener
}

export const clearToastListener = () => {
  logger.debug('Clearing listener')
  toastListener = null
}

