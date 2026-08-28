<template>
  <div>
    <a-steps :current="step" style="max-width:640px; margin:0 auto 24px">
      <a-step description="选择功能与版本">功能选择</a-step>
      <a-step description="时长与优惠">选择服务</a-step>
      <a-step description="扫码 / 卡支付">选择支付方式</a-step>
      <a-step>完成支付</a-step>
    </a-steps>

    <!-- step 0: choose module + plan -->
    <div v-show="step===0">
      <a-tabs v-model:active-key="curModule" type="card-gutter">
        <a-tab-pane v-for="m in modules" :key="String(m.module_id)">
          <template #title>
            {{ m.module_name }}
            <a-tag v-if="m.module_id === 0" color="red" size="small" style="margin-left:6px">超值</a-tag>
          </template>
        </a-tab-pane>
      </a-tabs>

      <a-alert v-if="String(curModule) === '0'" type="success" style="margin-bottom:16px">
        一次开通全部 {{ realModuleCount }} 个功能，比逐个购买省下大部分费用；到期时间统一管理。
      </a-alert>

      <a-row :gutter="16">
        <a-col v-for="p in plansOf(curModule)" :key="p.id" :span="6">
          <a-card :bordered="true" :class="['plan-card', { picked: picked?.id===p.id, bundle: p.all_modules }]" hoverable @click="picked = p" style="margin-bottom:16px">
            <div style="text-align:center">
              <div style="font-size:16px; font-weight:600">{{ p.name }}</div>
              <a-tag :color="p.level==='free' ? 'gray' : (p.all_modules ? 'red' : 'gold')" style="margin:8px 0">
                {{ p.level==='free' ? '免费版' : (p.all_modules ? '全能版' : '高级版') }}
              </a-tag>
              <div style="font-size:28px; font-weight:700; color: rgb(var(--primary-6))">${{ p.price }}<span style="font-size:13px; color:var(--color-text-3)">/月</span></div>
              <div v-if="saving(p)" style="font-size:12px; color:#f53f3f; margin-top:2px">
                单买合计 ${{ saving(p).sum }} · 省 {{ saving(p).off }}%
              </div>
              <a-divider style="margin:12px 0" />
              <div style="font-size:13px; color:var(--color-text-2); line-height:2">
                <div v-if="p.all_modules"><b>解锁全部 {{ realModuleCount }} 个功能</b></div>
                <div>每个FB号列表限制：{{ p.num }}</div>
                <div>套餐总数：{{ p.total_num }}</div>
                <div>客服支持：{{ p.level==='free' ? '论坛支持' : '专属客服' }}</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>
      <div style="text-align:center; margin-top:8px">
        <a-button type="primary" size="large" :disabled="!picked || picked.level==='free'" @click="step=1">下一步</a-button>
      </div>
    </div>

    <!-- step 1: months + promo -->
    <div v-show="step===1" style="max-width:560px; margin:0 auto">
      <a-card :title="`${picked?.module_name} · ${picked?.name}`" :bordered="false">
        <a-form layout="vertical">
          <a-form-item label="购买时长">
            <a-radio-group v-model="months" type="button">
              <a-radio :value="1">1 个月</a-radio><a-radio :value="3">3 个月</a-radio>
              <a-radio :value="6">6 个月</a-radio><a-radio :value="12">12 个月</a-radio>
            </a-radio-group>
          </a-form-item>
          <a-form-item label="优惠券">
            <a-input-search v-model="promo" placeholder="输入优惠券代码（FB10 / FB20 / VERYFB）" search-button @search="applyPromo">
              <template #button-default>核验</template>
            </a-input-search>
          </a-form-item>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="服务单价 USD">${{ picked?.price }}</a-descriptions-item>
            <a-descriptions-item label="购买月数">{{ months }} 个月</a-descriptions-item>
            <a-descriptions-item label="优惠">{{ discount<1 ? Math.round((1-discount)*100)+'% off' : '无' }}</a-descriptions-item>
            <a-descriptions-item label="总额 USD">${{ total }}</a-descriptions-item>
            <a-descriptions-item label="折后应付 USD"><b style="color:rgb(var(--primary-6))">${{ payable }}</b></a-descriptions-item>
            <a-descriptions-item label="折后应付 CNY">¥{{ (payable * 6.7291).toFixed(2) }}</a-descriptions-item>
          </a-descriptions>
        </a-form>
        <div style="margin-top:16px; text-align:right">
          <a-button @click="step=0" style="margin-right:8px">上一步</a-button>
          <a-button type="primary" @click="step=2">下一步</a-button>
        </div>
      </a-card>
    </div>

    <!-- step 2: pay method -->
    <div v-show="step===2" style="max-width:560px; margin:0 auto">
      <a-card title="选择支付方式" :bordered="false">
        <a-radio-group v-model="payMethod" direction="vertical" style="width:100%">
          <a-radio value="stripe"><icon-common /> 信用卡 / Stripe</a-radio>
          <a-radio value="cryptomus"><icon-safe /> 加密货币 / Cryptomus</a-radio>
        </a-radio-group>
        <a-divider />
        <div style="text-align:center">
          <div style="font-size:14px; color:var(--color-text-3)">应付金额</div>
          <div style="font-size:30px; font-weight:700; color:rgb(var(--primary-6))">${{ payable }}</div>
          <a-button type="primary" size="large" :loading="paying" style="margin-top:16px" @click="pay">付款</a-button>
          <div style="margin-top:8px"><a-button type="text" @click="step=1">上一步</a-button></div>
        </div>
      </a-card>
    </div>

    <!-- step 3: done -->
    <a-result v-show="step===3" status="success" title="支付成功" :sub-title="`订单号：${ordernum}`">
      <template #extra>
        <a-button type="primary" @click="$router.push({ name: 'user' })">查看订单</a-button>
        <a-button @click="reset">继续购买</a-button>
      </template>
    </a-result>

    <!-- crypto qr modal -->
    <a-modal v-model:visible="qrVisible" title="扫码支付（演示）" @ok="confirmPay" ok-text="我已付款">
      <div style="text-align:center">
        <img v-if="qr" :src="qr" style="width:220px; height:220px" />
        <p style="font-size:12px; word-break:break-all">地址：{{ address }}</p>
        <p>应付：<b>${{ payable }}</b></p>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue';
import { useRoute } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import { getServiceList, createPaymentIntent, cryptomus, mockConfirm, promoInfo } from '../../api';

const route = useRoute();
const services = ref([]);
const curModule = ref('0');   // open on the all-access bundle
const picked = ref(null);
const step = ref(0);
const months = ref(1);
const promo = ref('');
const discount = ref(1);
const payMethod = ref('stripe');
const paying = ref(false);
const ordernum = ref('');
const qrVisible = ref(false);
const qr = ref(''); const address = ref('');

const modules = computed(() => {
  const seen = new Map();
  for (const s of services.value) if (!seen.has(s.module_id)) seen.set(s.module_id, { module_id: s.module_id, module_name: s.module_name });
  return [...seen.values()];
});
function plansOf(mid) { return services.value.filter((s) => String(s.module_id) === String(mid)).sort((a, b) => a.sort - b.sort); }

// real modules = everything except the bundle pseudo-module (module_id 0)
const realModuleIds = computed(() => [...new Set(services.value.filter((s) => s.module_id !== 0).map((s) => s.module_id))]);
const realModuleCount = computed(() => realModuleIds.value.length);

// What the same tier would cost bought module-by-module. Matches on the plan
// letter (A/B/C) and falls back to a module's top plan when that letter is
// missing, so the comparison is against real listed prices, not a made-up one.
function saving(p) {
  if (!p || !p.all_modules) return null;
  const letter = (String(p.name).match(/([A-D])$/) || [])[1];
  if (!letter) return null;
  let sum = 0;
  for (const mid of realModuleIds.value) {
    const paid = services.value.filter((s) => s.module_id === mid && s.level !== 'free').sort((a, b) => a.sort - b.sort);
    if (!paid.length) continue;
    const match = paid.find((s) => String(s.name).endsWith(letter)) || paid[paid.length - 1];
    sum += parseFloat(match.price) || 0;
  }
  const price = parseFloat(p.price) || 0;
  if (!sum || sum <= price) return null;
  return { sum: sum.toFixed(2), off: Math.round((1 - price / sum) * 100) };
}
const total = computed(() => picked.value ? (parseFloat(picked.value.price) * months.value).toFixed(2) : '0.00');
const payable = computed(() => picked.value ? (parseFloat(picked.value.price) * months.value * discount.value).toFixed(2) : '0.00');

async function applyPromo() {
  if (!promo.value) return;
  try { const r = await promoInfo(promo.value); if (r.status === 1) { discount.value = r.data.discount; Message.success('优惠券已应用：' + r.data.label); } else Message.error(r.info); }
  catch { Message.error('优惠券无效'); }
}
async function pay() {
  paying.value = true;
  try {
    const body = { service_id: picked.value.id, months: months.value, order_type: 'buy', pay_method: payMethod.value, discount: discount.value, currency: 'USD' };
    if (payMethod.value === 'cryptomus') {
      const r = await cryptomus(body);
      if (r.status === 1) { ordernum.value = r.data.ordernum; qr.value = r.data.qr; address.value = r.data.address; qrVisible.value = true; }
    } else {
      const r = await createPaymentIntent(body);
      if (r.status === 1) { ordernum.value = r.data.ordernum; await confirmPay(); }
    }
  } finally { paying.value = false; }
}
async function confirmPay() {
  const r = await mockConfirm(ordernum.value);
  if (r.status === 1) { qrVisible.value = false; step.value = 3; Message.success('支付成功'); }
  else Message.error(r.info || '支付失败');
}
function reset() { step.value = 0; picked.value = null; months.value = 1; promo.value = ''; discount.value = 1; }

function syncFromRoute() {
  if (route.query.module != null && route.query.module !== '') curModule.value = String(route.query.module);
}

onMounted(async () => {
  const r = await getServiceList();
  if (r.status === 1) services.value = r.data;
  syncFromRoute();
});

// Routes are kept alive, so re-entering this page would otherwise show the old
// success screen and ignore a new ?module= coming from 用户中心's 购买 button.
onActivated(() => {
  if (step.value === 3) reset();
  syncFromRoute();
});
</script>

<style scoped>
.plan-card { cursor: pointer; transition: all .2s; }
.plan-card.picked { border-color: rgb(var(--primary-6)); box-shadow: 0 0 0 2px rgba(var(--primary-6), .2); }
.plan-card.bundle { border-color: #ffd6d6; background: linear-gradient(180deg, #fff8f8 0%, var(--color-bg-2) 60%); }
</style>
