import { utils, wordlists } from 'ethers'
import { MNEMONIC_LENGTH_MAX, MNEMONIC_LENGTH_MIN } from 'src/constants/accounts'
import { normalizeTextInput } from 'src/utils/string'

export enum MnemonicValidationError {
  InvalidWord = 'InvalidWord',
  NotEnoughWords = 'NotEnoughWords',
  TooManyWords = 'TooManyWords',
  InvalidPhrase = 'InvalidPhrase',
}

// Validate if word is part of the BIP-39 word set [https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki]
export function validateSetOfWords(mnemonic?: string): {
  error?: MnemonicValidationError
  invalidWord?: string
  isValidLength: boolean // we need this to enable/disable buttons for all error return types
} {
  if (!mnemonic) return { error: MnemonicValidationError.NotEnoughWords, isValidLength: false }

  const formatted = normalizeTextInput(mnemonic)
  const split = formatted.split(' ')
  const isValidLength = split.length >= MNEMONIC_LENGTH_MIN && split.length <= MNEMONIC_LENGTH_MAX

  const invalidWords = split.filter((item) => wordlists.en.getWordIndex(item) === -1)
  if (invalidWords.length) {
    return {
      error: MnemonicValidationError.InvalidWord,
      invalidWord: invalidWords.at(-1),
      isValidLength,
    }
  }

  if (split.length < MNEMONIC_LENGTH_MIN)
    return { error: MnemonicValidationError.NotEnoughWords, isValidLength }

  if (split.length > MNEMONIC_LENGTH_MAX)
    return { error: MnemonicValidationError.TooManyWords, isValidLength }

  return { isValidLength }
}

// Validate phrase by verifying the checksum
export function validateMnemonic(mnemonic?: string): {
  error?: MnemonicValidationError
  invalidWord?: string
  validMnemonic?: string
} {
  const { error, invalidWord } = validateSetOfWords(mnemonic)
  if (error) return { error, invalidWord }

  const formatted = normalizeTextInput(mnemonic ?? '')
  if (!utils.isValidMnemonic(formatted)) return { error: MnemonicValidationError.InvalidPhrase }

  return { validMnemonic: formatted }
}

export function isValidDerivationPath(derivationPath: string) {
  if (!derivationPath) return false
  const split = derivationPath.trim().split('/')
  // TODO validate each path segment individually here
  return split[0] === 'm' && split.length === 6
}

// Check if phrase has trailing whitespace, indicating the user is done typing the previous word.
export function userFinishedTypingWord(mnemonic: string | undefined) {
  if (!mnemonic) return false
  const lastChar = mnemonic[mnemonic.length - 1]
  return lastChar === ' '
}
