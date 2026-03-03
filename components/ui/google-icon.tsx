import { Text, View } from 'react-native';

interface GoogleIconProps {
  size?: number;
}

// Simple "G" logo using styled text -- avoids requiring react-native-svg
export function GoogleIcon({ size = 20 }: GoogleIconProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: size * 0.65,
          fontWeight: '700',
          color: '#4285F4',
          lineHeight: size * 0.75,
        }}
      >
        G
      </Text>
    </View>
  );
}
