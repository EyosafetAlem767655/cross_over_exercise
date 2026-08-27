"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardAPI } from "@/lib/api";
import { DashboardStats } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";

export default function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    const fetchStats = () => {
      dashboardAPI
        .getStats(token)
        .then((res) => setStats(res.data))
        .catch((err) => setError(err.message))
        .finally(() => setIsLoading(false));
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [token]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Spinner size="lg" /></div>;
  }

  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }

  const statCards = [
    { label: "Total Events", value: stats?.totalEvents || 0 },
    { label: "Tickets Sold", value: formatNumber(stats?.totalTicketsSold || 0) },
    { label: "Revenue", value: formatCurrency(stats?.netRevenue || stats?.totalRevenue || 0) },
    { label: "Attendance Rate", value: `${stats?.attendanceRate || 0}%` },
  ];

  const financialCards = [
    { label: "Gross Revenue", value: formatCurrency(stats?.grossRevenue || 0) },
    { label: "Total Refunds", value: formatCurrency(stats?.totalRefunds || 0) },
    { label: "Net Revenue", value: formatCurrency(stats?.netRevenue || 0) },
    { label: "Cancellations", value: formatNumber(stats?.totalRefundCount || 0) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Financial Summary</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {financialCards.map((stat) => (
              <div key={stat.label} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                <p className="text-lg font-semibold text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {stats?.categoryBreakdown && Object.keys(stats.categoryBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Category Breakdown</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.categoryBreakdown).map(([category, data]) => (
                <div key={category} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-gray-600 font-medium">{category}</span>
                  <div className="text-right text-sm space-x-4">
                    <span className="text-gray-500">{data.events} events</span>
                    <span className="text-gray-500">{data.tickets} tickets</span>
                    <span className="text-gray-900 font-medium">{formatCurrency(data.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Recent Sales (Last 7 Days)</h2>
        </CardHeader>
        <CardContent>
          {stats?.recentSales && stats.recentSales.length > 0 ? (
            <div className="space-y-2">
              {stats.recentSales.map((sale) => (
                <div key={sale.date} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-gray-600">{sale.date}</span>
                  <div className="text-right">
                    <span className="text-gray-900 font-medium">{sale.count} tickets</span>
                    <span className="text-gray-500 ml-4">{formatCurrency(sale.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No sales data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
