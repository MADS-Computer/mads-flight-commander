import React, { type ReactNode, type ErrorInfo } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Platform,
} from 'react-native';

interface Props {
  children:   ReactNode;
  fallbackLabel?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reload = () => {
    if (Platform.OS === 'web') {
      window.location.reload();
    } else {
      this.setState({ error: null });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const { message, stack } = this.state.error;

    return (
      <View style={styles.container}>
        <Text style={styles.icon}>⚠</Text>
        <Text style={styles.title}>
          {this.props.fallbackLabel ?? 'Something went wrong'}
        </Text>
        <Text style={styles.message}>{message}</Text>

        {__DEV__ && stack ? (
          <ScrollView style={styles.stackBox} contentContainerStyle={{ padding: 10 }}>
            <Text style={styles.stack}>{stack}</Text>
          </ScrollView>
        ) : null}

        <Pressable style={styles.btn} onPress={this.reload}>
          <Text style={styles.btnText}>Reload</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#0a0a0f',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         24,
    gap:             12,
  },
  icon: {
    fontSize: 40,
    color:    '#FFD700',
  },
  title: {
    fontSize:   18,
    fontWeight: '700',
    color:      '#ffffff',
    textAlign:  'center',
  },
  message: {
    fontSize:  13,
    color:     '#888899',
    textAlign: 'center',
    maxWidth:  340,
  },
  stackBox: {
    maxHeight:       160,
    width:           '100%',
    backgroundColor: '#0f0f1e',
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     '#1e1e38',
  },
  stack: {
    fontSize: 10,
    color:    '#555566',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  btn: {
    marginTop:         8,
    backgroundColor:   '#FFD700',
    paddingHorizontal: 32,
    paddingVertical:   12,
    borderRadius:      8,
  },
  btnText: {
    color:      '#000',
    fontWeight: '700',
    fontSize:   14,
  },
});
