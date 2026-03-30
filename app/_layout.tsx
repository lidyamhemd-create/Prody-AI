import { Stack } from 'expo-router';
import { PaperProvider, MD3DarkTheme, Portal } from 'react-native-paper';
import { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { paperTheme } from '../constants/theme';

const theme = {
  ...MD3DarkTheme,
  ...paperTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...paperTheme.colors,
  },
};

export default function Layout() {
  const appTheme = useMemo(() => theme, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={appTheme}>
        <Portal.Host>
          <Stack>
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack>
        </Portal.Host>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
