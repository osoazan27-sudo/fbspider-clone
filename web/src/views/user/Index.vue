<template>
  <div class="module-card">
    <a-tabs v-model:active-key="tab" type="rounded">
      <a-tab-pane key="func" title="功能管理">
        <a-table :data="myServices" :pagination="false" size="small">
          <template #columns>
            <a-table-column title="功能" data-index="module_name" />
            <a-table-column title="套餐"><template #cell="{ record }"><a-tag :color="record.level_id>0?'gold':'gray'">{{ record.name }}</a-tag></template></a-table-column>
            <a-table-column title="每个FB号列表限制" data-index="num" />
            <a-table-column title="套餐总数" data-index="total_num" />
            <a-table-column title="开始时间"><template #cell="{ record }">{{ fmt(record.start_time) }}</template></a-table-column>
            <a-table-column title="结束时间"><template #cell="{ record }">{{ fmt(record.end_time) }}</template></a-table-column>
            <a-table-column title="剩余天数"><template #cell="{ record }">{{ daysLeft(record.end_time) }} 天</template></a-table-column>
            <a-table-column title="是否有效"><template #cell="{ record }">
              <a-tag :color="daysLeft(record.end_time)>0?'green':'red'">{{ daysLeft(record.end_time)>0?'生效中':'已过期' }}</a-tag></template></a-table-column>
            <a-table-column title="操作"><template #cell="{ record }">
              <a-button type="text" size="mini" @click="$router.push({ name:'payment', query:{ module: record.module_id } })">升级</a-button>
              <a-button type="text" size="mini" @click="$router.push({ name:'payment', query:{ module: record.module_id } })">续费</a-button>
            </template></a-table-column>
          </template>
          <template #empty><a-empty description="暂无已购买的功能"><a-button type="primary" @click="$router.push({ name:'payment' })">去购买</a-button></a-empty></template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="order" title="订单管理">
        <a-table :data="orders" :pagination="{ pageSize:10 }" size="small" :scroll="{ x: 1400 }">
          <template #columns>
            <a-table-column title="订单号" :width="200" data-index="ordernum" />
            <a-table-column title="模块名称" :width="130" data-index="module_name" />
            <a-table-column title="订单类型" :width="90"><template #cell="{ record }">{{ ({buy:'购买',renew:'续费',upgrade:'升级'})[record.order_type] }}</template></a-table-column>
            <a-table-column title="购买时长" :width="90"><template #cell="{ record }">{{ record.months }} 个月</template></a-table-column>
            <a-table-column title="订单金额" :width="90"><template #cell="{ record }">${{ record.amount }}</template></a-table-column>
            <a-table-column title="支付金额" :width="90"><template #cell="{ record }">${{ record.pay_amount }}</template></a-table-column>
            <a-table-column title="支付方式" :width="100" data-index="pay_method" />
            <a-table-column title="下单时间" :width="160"><template #cell="{ record }">{{ fmt(record.create_time) }}</template></a-table-column>
            <a-table-column title="支付状态" :width="90"><template #cell="{ record }">
              <a-tag :color="record.pay_status===1?'green':'orange'">{{ record.pay_status===1?'已支付':'未支付' }}</a-tag></template></a-table-column>
          </template>
          <template #empty><a-empty description="暂无订单" /></template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="setting" title="用户设置">
        <a-row :gutter="24">
          <a-col :span="12">
            <a-card title="基本信息" :bordered="false">
              <a-form :model="profile" layout="vertical" style="max-width:360px">
                <a-form-item label="账号ID"><a-input :model-value="String(userStore.id)" disabled /></a-form-item>
                <a-form-item label="用户名"><a-input v-model="profile.username" /></a-form-item>
                <a-form-item><a-button type="primary" @click="saveProfile">保存</a-button></a-form-item>
              </a-form>
            </a-card>
          </a-col>
          <a-col :span="12">
            <a-card title="修改密码" :bordered="false">
              <a-form :model="pwd" layout="vertical" style="max-width:360px">
                <a-form-item label="当前密码"><a-input-password v-model="pwd.current" /></a-form-item>
                <a-form-item label="新密码"><a-input-password v-model="pwd.password" /></a-form-item>
                <a-form-item label="确认新密码"><a-input-password v-model="pwd.confirm" /></a-form-item>
                <a-form-item><a-button type="primary" @click="savePwd">修改密码</a-button></a-form-item>
              </a-form>
            </a-card>
            <a-card title="修改邮箱" :bordered="false" style="margin-top:16px">
              <a-form :model="mail" layout="vertical" style="max-width:360px">
                <a-form-item label="当前邮箱"><a-input :model-value="userStore.email" disabled /></a-form-item>
                <a-form-item label="新邮箱"><a-input v-model="mail.email" /></a-form-item>
                <a-form-item label="验证码">
                  <a-input-search v-model="mail.code" placeholder="演示验证码 000000" search-button @search="sendCode">
                    <template #button-default>发送验证码</template>
                  </a-input-search>
                </a-form-item>
                <a-form-item><a-button type="primary" @click="saveMail">保存邮箱</a-button></a-form-item>
              </a-form>
            </a-card>
          </a-col>
        </a-row>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import { useUserStore } from '../../store/user';
import { getMyServices, getMyOrders, updateAccount, changePassword, updateEmail, emsSend, emsCheck } from '../../api';

const route = useRoute();
const userStore = useUserStore();
const tab = ref(route.query.tab || 'func');
const myServices = ref([]);
const orders = ref([]);
const profile = ref({ username: userStore.username });
const pwd = ref({ current: '', password: '', confirm: '' });
const mail = ref({ email: '', code: '' });

function fmt(ts) { return ts ? new Date(ts * 1000).toLocaleString() : '-'; }
function daysLeft(ts) { return ts ? Math.max(0, Math.ceil((ts * 1000 - Date.now()) / 86400000)) : 0; }

async function loadAll() {
  const [s, o] = await Promise.all([getMyServices(), getMyOrders()]);
  if (s.status === 1) myServices.value = s.data;
  if (o.status === 1) orders.value = o.data;
}
async function saveProfile() { const r = await updateAccount({ username: profile.value.username }); if (r.status === 1) { userStore.setInfo({ username: profile.value.username }); Message.success('账号已保存~'); } }
async function savePwd() {
  if (pwd.value.password !== pwd.value.confirm) return Message.error('两次输入不一致');
  const r = await changePassword({ current: pwd.value.current, password: pwd.value.password });
  if (r.status === 1) { Message.success('密码已更新'); pwd.value = { current: '', password: '', confirm: '' }; } else Message.error(r.info);
}
async function sendCode() { const r = await emsSend({ email: mail.value.email }); if (r.status === 1) Message.success(r.info); }
async function saveMail() {
  const c = await emsCheck({ code: mail.value.code });
  if (c.status !== 1) return Message.error('验证码错误');
  const r = await updateEmail({ email: mail.value.email, code: mail.value.code });
  if (r.status === 1) { userStore.setInfo({ email: mail.value.email }); Message.success('邮箱已更新'); } else Message.error(r.info);
}
onMounted(loadAll);
</script>
