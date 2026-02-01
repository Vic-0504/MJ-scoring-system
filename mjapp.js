import React, { useState } from 'react';
import { 
  Text, View, StyleSheet, TextInput, TouchableOpacity, 
  Modal, StatusBar, Keyboard, TouchableWithoutFeedback, 
  KeyboardAvoidingView, Platform, ScrollView, SafeAreaView, Alert 
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// ==========================================
// 🎨 設定與配色
// ==========================================

const Colors = {
  background: '#182a66',
  text: '#ffffff',
  inputBg: 'rgba(255, 255, 255, 0.1)',
  
  east: '#700061',  
  south: '#950000', 
  west: '#016412',  
  north: '#01645a', 
  
  win: '#ffeb3b',       
  dealer: '#ff5252',    
  modalBg: '#121f4d',   
  btnConfirm: '#ffffff', 
  btnText: '#182a66',    
};

const RULE_LIST = [
  { id: 'zimo', name: '自摸', tai: 1 },
  { id: 'menqing', name: '門清', tai: 1 },
  { id: 'wind_seat', name: '門風(座位)', tai: 1 },
  { id: 'wind_round', name: '圈風(局)', tai: 1 },
  { id: 'dragon', name: '中/發/白', tai: 1 },
  { id: 'flower', name: '花牌(每張)', tai: 1 },
  { id: 'pinghu', name: '平胡', tai: 2 },
  { id: 'sankan', name: '三暗刻', tai: 2 },
  { id: 'pong', name: '碰碰胡', tai: 4 },
  { id: 'mix', name: '混一色', tai: 4 },
  { id: 'pure', name: '清一色', tai: 8 },
  { id: 'small3', name: '小三元', tai: 4 },
  { id: 'big3', name: '大三元', tai: 8 },
  { id: 'small4', name: '小四喜', tai: 8 },
  { id: 'big4', name: '大四喜', tai: 16 },
  { id: 'tianhu', name: '天胡/地胡', tai: 16 },
  { id: 'words', name: '字一色', tai: 16 },
];

const Stack = createStackNavigator();

// ==========================================
// 🏠 首頁 (Home)
// ==========================================

function HomeScreen({ navigation }) {
  const [baseScore, setBaseScore] = useState('300');
  const [pointScore, setPointScore] = useState('100');
  const [initialChips, setInitialChips] = useState('20000');
  const [rounds, setRounds] = useState('4');

  const handleStartGame = () => {
    navigation.navigate('Game', {
      base: parseInt(baseScore) || 300,
      point: parseInt(pointScore) || 100,
      chips: parseInt(initialChips) || 20000,
      totalRounds: parseInt(rounds) || 4,
    });
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: 'center' }}>
          
          <View style={styles.contentWrapper}>
            <Text style={styles.title}>MAHJONG</Text>
            <Text style={styles.subtitle}>SCORING SYSTEM</Text>
            
            <View style={styles.formContainer}>
              <InputRow label="底 (Base)" value={baseScore} onChange={setBaseScore} />
              <InputRow label="台 (Point)" value={pointScore} onChange={setPointScore} />
              <InputRow label="籌碼 (Chips)" value={initialChips} onChange={setInitialChips} />
              <InputRow label="圈數 (Rounds)" value={rounds} onChange={setRounds} />
            </View>

            <TouchableOpacity style={styles.mainBtn} onPress={handleStartGame}>
              <Text style={styles.mainBtnText}>START GAME</Text>
            </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const InputRow = ({ label, value, onChange }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <TextInput 
      style={styles.input} keyboardType="numeric" value={value} onChangeText={onChange}
      returnKeyType="done" placeholderTextColor="rgba(255,255,255,0.3)"
    />
  </View>
);

// ==========================================
// 🎮 遊戲主畫面 (Game)
// ==========================================

function GameScreen({ navigation, route }) {
  const { base, point, chips, totalRounds } = route.params;

  const [players, setPlayers] = useState([
    { id: 0, name: '東', score: chips, color: Colors.east, position: 'East' },
    { id: 1, name: '南', score: chips, color: Colors.south, position: 'South' },
    { id: 2, name: '西', score: chips, color: Colors.west, position: 'West' },
    { id: 3, name: '北', score: chips, color: Colors.north, position: 'North' },
  ]);

  // 🔄 遊戲進度狀態
  const [dealerIndex, setDealerIndex] = useState(0); 
  const [lianCount, setLianCount] = useState(1); 
  const [currentRound, setCurrentRound] = useState(1); // 目前第幾圈 (1=東風圈)
  const WINDS = ['東', '南', '西', '北'];

  // Modal 狀態
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [gameOverVisible, setGameOverVisible] = useState(false); // 🆕 最終結算畫面
  
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(null);
  const [selectedRules, setSelectedRules] = useState(new Set());
  const [manualExtra, setManualExtra] = useState('');
  const [pendingTransaction, setPendingTransaction] = useState(null);

  // --- 邏輯區 ---

  // 1. 下莊/過莊 邏輯 (包含遊戲結束判斷)
  const performNextDealer = () => {
    let nextDealer = dealerIndex + 1;
    let nextRound = currentRound;

    // 如果超過北風位 (3)，回到東風位 (0)，圈數+1
    if (nextDealer > 3) {
      nextDealer = 0;
      nextRound += 1;
    }

    // ⛔ 檢查是否遊戲結束
    if (nextRound > totalRounds) {
      setGameOverVisible(true);
      return;
    }

    setDealerIndex(nextDealer);
    setLianCount(1);
    setCurrentRound(nextRound);
  };

  // 手動下莊按鈕 (防呆用)
  const handleManualNextDealer = () => {
    Alert.alert("手動下莊", "確定換下一家？(通常系統會自動判斷)", [
      { text: "取消", style: "cancel" },
      { text: "確定", onPress: performNextDealer }
    ]);
  };

  const handleManualAddLian = () => setLianCount(prev => prev + 1);

  const openActionMenu = (index) => {
    setSelectedPlayerIndex(index);
    setSelectedRules(new Set());
    setManualExtra('');
    setRuleModalVisible(true);
  };

  const toggleRule = (ruleId) => {
    const newSet = new Set(selectedRules);
    if (newSet.has(ruleId)) newSet.delete(ruleId);
    else newSet.add(ruleId);
    setSelectedRules(newSet);
  };

  const calculateBaseTai = () => {
    let total = 0;
    RULE_LIST.forEach(rule => {
      if (selectedRules.has(rule.id)) total += rule.tai;
    });
    total += (parseInt(manualExtra) || 0);
    return total;
  };

  // 2. 準備結算單
  const prepareSettlement = (type, loserIndex = null) => {
    const winnerIndex = selectedPlayerIndex;
    const baseTai = calculateBaseTai();
    
    // 莊家是否參與? (贏家是莊 OR 輸家是莊)
    let isDealerInvolved = false;
    if (type === 'tsumo') isDealerInvolved = (winnerIndex === dealerIndex); 
    else isDealerInvolved = (winnerIndex === dealerIndex || loserIndex === dealerIndex);

    const dealerTai = isDealerInvolved ? (1 + (2 * lianCount)) : 0;
    const finalTai = baseTai + dealerTai;
    const amount = base + (finalTai * point);

    setPendingTransaction({
      winnerIndex,
      loserIndex,
      type,
      baseTai,
      dealerTai,
      finalTai,
      amount,
      isDealerInvolved
    });

    setRuleModalVisible(false);
    setSettleModalVisible(true);
  };

  // 3. 執行交易並自動判斷莊家去留
  const confirmTransaction = () => {
    if (!pendingTransaction) return;
    const { winnerIndex, loserIndex, type, amount } = pendingTransaction;
    
    // A. 扣錢
    let newPlayers = [...players];
    if (type === 'tsumo') {
      newPlayers = newPlayers.map((p, idx) => {
        if (idx === winnerIndex) return { ...p, score: p.score + (amount * 3) };
        else return { ...p, score: p.score - amount };
      });
    } else {
      newPlayers[winnerIndex].score += amount;
      newPlayers[loserIndex].score -= amount;
    }
    setPlayers(newPlayers);
    setSettleModalVisible(false);
    setPendingTransaction(null);

    // B. 自動化莊家邏輯
    setTimeout(() => {
      if (winnerIndex === dealerIndex) {
        // 莊家贏 -> 連莊
        Alert.alert("莊家連莊", "莊家贏了，連莊數 +1", [{text:"OK", onPress: () => setLianCount(prev => prev + 1)}]);
      } else {
        // 閒家贏 -> 下莊
        Alert.alert("換莊", "莊家輸了，換下一家", [{text:"OK", onPress: performNextDealer}]);
      }
    }, 500);
  };

  // 渲染排名項目
  const RankItem = ({ player, rank }) => (
    <View style={styles.rankRow}>
      <Text style={styles.rankNum}>#{rank}</Text>
      <Text style={[styles.rankName, { color: player.color }]}>{player.name}</Text>
      <Text style={styles.rankScore}>${player.score}</Text>
      <Text style={[styles.rankNet, { color: player.score >= chips ? Colors.win : Colors.dealer }]}>
        {player.score - chips > 0 ? '+' : ''}{player.score - chips}
      </Text>
    </View>
  );

  const PlayerCard = ({ index }) => {
    const p = players[index];
    const isDealer = index === dealerIndex;
    return (
      <TouchableOpacity 
        style={[styles.playerBlock, { backgroundColor: p.color }, isDealer && styles.dealerBorder]}
        onPress={() => openActionMenu(index)} activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.blockPos}>{p.position}</Text>
          {isDealer && (
            <View style={styles.dealerBadge}>
              <Text style={styles.dealerText}>莊{lianCount>1?`連${lianCount}`:''}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.blockScore}>{p.score}</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.blockName}>{p.name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>底{base} / 台{point}</Text>
          <Text style={styles.headerSub}>
            目前: {WINDS[(currentRound-1)%4]}風圈 ({currentRound}/{totalRounds})
          </Text>
        </View>
        <TouchableOpacity style={styles.exitBtn} onPress={() => setGameOverVisible(true)}>
          <Text style={styles.exitBtnText}>強制結算</Text>
        </TouchableOpacity>
      </View>

      {/* Table Area */}
      <View style={styles.tableContainer}>
        <View style={styles.playerRow}><PlayerCard index={3} /></View>
        <View style={styles.playerRowMiddle}>
          <PlayerCard index={2} />
          <View style={styles.centerControl}>
             <TouchableOpacity style={styles.centerBtn} onPress={handleManualNextDealer}>
               <Text style={styles.centerBtnText}>手動下莊</Text>
             </TouchableOpacity>
             <View style={styles.centerDivider} />
             <TouchableOpacity style={styles.centerBtn} onPress={handleManualAddLian}>
               <Text style={styles.centerBtnText}>連莊 +</Text>
             </TouchableOpacity>
          </View>
          <PlayerCard index={0} />
        </View>
        <View style={styles.playerRow}><PlayerCard index={1} /></View>
      </View>

      {/* Modal 1: 選擇規則 */}
      <Modal animationType="fade" transparent={true} visible={ruleModalVisible} onRequestClose={() => setRuleModalVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.winnerTitle}>{selectedPlayerIndex !== null ? players[selectedPlayerIndex].name : ''} 胡牌</Text>
                <Text style={styles.totalTaiText}>{calculateBaseTai()} 台</Text>
              </View>
              <Text style={styles.hintText}>* 莊家台 ({1+2*lianCount}台) 若適用會自動加入</Text>
              <ScrollView style={styles.ruleScroll}>
                <View style={styles.ruleContainer}>
                  {RULE_LIST.map((rule) => {
                    const isSelected = selectedRules.has(rule.id);
                    return (
                      <TouchableOpacity 
                        key={rule.id} style={[styles.ruleTag, isSelected && styles.ruleTagSelected]}
                        onPress={() => toggleRule(rule.id)}
                      >
                        <Text style={[styles.ruleTagName, isSelected && styles.ruleTagNameSelected]}>{rule.name}</Text>
                        {isSelected && <Text style={styles.ruleTagVal}>{rule.tai}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              <View style={styles.extraRow}>
                <Text style={styles.labelSmall}>花牌/手動台:</Text>
                <TextInput 
                  style={styles.inputSmall} keyboardType="numeric" value={manualExtra} onChangeText={setManualExtra}
                  placeholder="0" placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>
              <View style={styles.actionArea}>
                <TouchableOpacity style={styles.actionMain} onPress={() => prepareSettlement('tsumo')}>
                  <Text style={styles.actionMainText}>自摸 (三家賠)</Text>
                </TouchableOpacity>
                <View style={styles.loserRow}>
                  {players.map((p, idx) => {
                    if (idx === selectedPlayerIndex) return null;
                    return (
                      <TouchableOpacity key={idx} style={[styles.loserBtn, { backgroundColor: p.color }]} onPress={() => prepareSettlement('ron', idx)}>
                        <Text style={styles.loserText}>抓 {p.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setRuleModalVisible(false)}>
                  <Text style={styles.cancelText}>取消</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal 2: 結算確認單 */}
      <Modal animationType="slide" transparent={true} visible={settleModalVisible} onRequestClose={() => setSettleModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { height: 'auto', maxHeight: '70%' }]}>
            <Text style={styles.modalTitleCenter}>本次結算</Text>
            {pendingTransaction && (
              <View style={styles.settleContainer}>
                <View style={styles.settleRow}>
                  <Text style={styles.settleLabel}>贏家</Text>
                  <Text style={[styles.settleValue, { color: players[pendingTransaction.winnerIndex].color }]}>
                    {players[pendingTransaction.winnerIndex].name}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.settleRow}>
                  <Text style={styles.settleLabel}>牌型</Text>
                  <Text style={styles.settleValue}>{pendingTransaction.baseTai} 台</Text>
                </View>
                {pendingTransaction.dealerTai > 0 && (
                  <View style={styles.settleRow}>
                    <Text style={[styles.settleLabel, {color: Colors.dealer}]}>莊家加成</Text>
                    <Text style={[styles.settleValue, {color: Colors.dealer}]}>+ {pendingTransaction.dealerTai} 台</Text>
                  </View>
                )}
                <View style={styles.settleRowTotal}>
                  <Text style={styles.totalText}>共 {pendingTransaction.finalTai} 台</Text>
                </View>
                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>支付金額</Text>
                  <Text style={styles.amountValue}>${pendingTransaction.amount}</Text>
                </View>
              </View>
            )}
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmTransaction}>
              <Text style={styles.confirmBtnText}>確認並執行</Text>
            </TouchableOpacity>
             <TouchableOpacity style={styles.cancelBtn} onPress={() => setSettleModalVisible(false)}>
                <Text style={styles.cancelText}>返回</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal 3: Game Over 最終結算 (🆕 新增) */}
      <Modal animationType="fade" transparent={true} visible={gameOverVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitleCenter, {color: Colors.win, fontSize: 32}]}>🎉 牌局結束 🎉</Text>
            <View style={styles.rankContainer}>
              {[...players].sort((a,b) => b.score - a.score).map((p, idx) => (
                <RankItem key={p.id} player={p} rank={idx + 1} />
              ))}
            </View>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.confirmBtnText}>回到首頁</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Game" component={GameScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ==========================================
// 💅 CSS
// ==========================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  
  // Home
  contentWrapper: { padding: 40, alignItems: 'center', width: '100%' },
  title: { fontSize: 48, fontWeight: '200', color: Colors.text, letterSpacing: 5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 60, letterSpacing: 8 },
  formContainer: { width: '100%', marginBottom: 40 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingBottom: 5 },
  label: { flex: 1, color: Colors.text, fontSize: 16, letterSpacing: 1 },
  input: { color: Colors.win, fontSize: 24, fontWeight: 'bold', width: 120, textAlign: 'right' },
  mainBtn: { backgroundColor: Colors.btnConfirm, paddingVertical: 18, width: '100%', alignItems: 'center' },
  mainBtnText: { color: Colors.btnText, fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },

  // Game Header
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  exitBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 5 },
  exitBtnText: { color: Colors.text, fontSize: 12 },

  // Table
  tableContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 20 },
  playerRow: { alignItems: 'center', marginVertical: 5 },
  playerRowMiddle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 15 },
  
  // Card
  playerBlock: { width: 100, height: 120, borderRadius: 8, padding: 8, flexDirection: 'column', justifyContent: 'space-between', shadowColor: "#000", shadowOffset: {width: 0, height: 5}, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  dealerBorder: { borderWidth: 2, borderColor: Colors.win },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  blockPos: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 'bold' },
  dealerBadge: { backgroundColor: Colors.win, paddingHorizontal: 4, borderRadius: 2 },
  dealerText: { color: Colors.btnText, fontSize: 10, fontWeight: 'bold' },
  cardBody: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  blockScore: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  cardFooter: { alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)', paddingTop: 4 },
  blockName: { color: Colors.text, fontSize: 12 },

  // Center Control
  centerControl: { width: 90, height: 90, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 15 },
  centerBtn: { padding: 8, width: '100%', alignItems: 'center' },
  centerBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  centerDivider: { width: '80%', height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '90%', height: '80%', backgroundColor: Colors.modalBg, padding: 20, borderRadius: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  modalTitleCenter: { fontSize: 24, color: Colors.text, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  winnerTitle: { color: Colors.text, fontSize: 28, fontWeight: '200' },
  totalTaiText: { color: Colors.win, fontSize: 28, fontWeight: 'bold' },
  hintText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 15 },
  
  ruleScroll: { flex: 1 },
  ruleContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  ruleTag: { width: '48%', paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  ruleTagSelected: { backgroundColor: Colors.win },
  ruleTagName: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  ruleTagNameSelected: { color: Colors.btnText, fontWeight: 'bold' },
  ruleTagVal: { marginLeft: 5, color: Colors.btnText, fontSize: 12, fontWeight: 'bold' },

  extraRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 15 },
  labelSmall: { color: 'rgba(255,255,255,0.6)', marginRight: 10 },
  inputSmall: { flex: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.3)', color: Colors.text, fontSize: 18, textAlign: 'center' },

  actionArea: { marginTop: 5 },
  actionMain: { backgroundColor: Colors.btnConfirm, padding: 15, alignItems: 'center', marginBottom: 10, borderRadius: 8 },
  actionMainText: { color: Colors.btnText, fontWeight: 'bold', letterSpacing: 1 },
  loserRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  loserBtn: { flex: 1, padding: 12, marginHorizontal: 3, alignItems: 'center', borderRadius: 8 },
  loserText: { color: Colors.text, fontSize: 12, fontWeight: 'bold' },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },

  // Settlement & Game Over
  settleContainer: { marginBottom: 20 },
  settleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  settleRowTotal: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, marginBottom: 20 },
  settleLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 18 },
  settleValue: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 10 },
  totalText: { color: Colors.win, fontSize: 24, fontWeight: 'bold' },
  amountBox: { backgroundColor: 'rgba(0,0,0,0.2)', padding: 15, alignItems: 'center', borderRadius: 8 },
  amountLabel: { color: 'rgba(255,255,255,0.5)', marginBottom: 5 },
  amountValue: { color: Colors.win, fontSize: 32, fontWeight: 'bold' },
  confirmBtn: { backgroundColor: Colors.win, padding: 15, alignItems: 'center', borderRadius: 8, marginBottom: 10 },
  confirmBtnText: { color: Colors.btnText, fontSize: 18, fontWeight: 'bold' },
  
  rankContainer: { width: '100%', marginVertical: 20 },
  rankRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingBottom: 10 },
  rankNum: { width: 40, fontSize: 24, color: Colors.text, fontWeight: 'bold' },
  rankName: { flex: 1, fontSize: 20, fontWeight: 'bold' },
  rankScore: { fontSize: 20, color: Colors.text, marginRight: 15 },
  rankNet: { fontSize: 16, fontWeight: 'bold' }
});
