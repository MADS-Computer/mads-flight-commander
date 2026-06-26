import { View, StyleSheet } from 'react-native';

interface Props {
  percent: number;
  height?: number;
}

export function BatteryIndicator({ percent, height = 10 }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const color   = clamped > 50 ? '#00e676' : clamped > 20 ? '#ff8c00' : '#ff4444';
  const nibH    = Math.round(height * 0.5);

  return (
    <View style={[styles.row, { height }]}>
      {/* Battery body */}
      <View style={[styles.body, { borderColor: color + '55' }]}>
        <View
          style={[
            styles.fill,
            {
              width:           `${clamped}%`,
              backgroundColor: color,
              // low-battery danger pulse handled by caller via color alone
            },
          ]}
        />
      </View>
      {/* Positive terminal nub */}
      <View
        style={[
          styles.nib,
          {
            height:          nibH,
            marginTop:       (height - nibH) / 2,
            backgroundColor: color + '88',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  body: {
    flex:            1,
    height:          '100%',
    borderRadius:    3,
    borderWidth:     1,
    overflow:        'hidden',
    backgroundColor: '#1a1a2e',
  },
  fill: {
    height:       '100%',
    borderRadius: 2,
  },
  nib: {
    width:        3,
    borderRadius: 1,
    marginLeft:   2,
  },
});
