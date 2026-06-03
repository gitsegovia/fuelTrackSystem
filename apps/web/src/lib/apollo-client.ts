import { ApolloClient, InMemoryCache } from '@apollo/client'
import { createHttpLink } from '@apollo/client/link/http'
import { setContext } from '@apollo/client/link/context'

export function makeApolloClient() {
  const httpLink = createHttpLink({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URI || 'http://localhost:4000',
  })

  const authLink = setContext((_, { headers }) => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : '',
      },
    }
  })

  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
  })
}
