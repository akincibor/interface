import React, { PropsWithChildren } from 'react'
import { FlexAlignType } from 'react-native'
import { Flex } from 'src/components/layout'

type TokenMetadataProps = PropsWithChildren<{
  align?: FlexAlignType
}>

/** Helper component to format rhs metadata for a given token. */
export const TokenMetadata = ({
  children,
  align = 'flex-end',
}: TokenMetadataProps): JSX.Element => {
  return (
    <Flex row>
      <Flex alignItems={align} gap="xxs" minWidth={70}>
        {children}
      </Flex>
    </Flex>
  )
}
