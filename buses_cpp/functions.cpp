#include <algorithm>
#include <iostream>
#include <iomanip>
#include <future>
#include <ctime>
#include <sstream>
#include "fetch.h"
#include "functions.h"

json_vec_vec separate_directions(json root)
{
        auto buses = root["Siri"]["ServiceDelivery"]["VehicleMonitoringDelivery"][0]["VehicleActivity"];

        std::vector<json> direction_0(buses.size());
        auto copy_0 = std::copy_if(buses.begin(), buses.end(), direction_0.begin(), [](json x) { return x["MonitoredVehicleJourney"]["ProgressRate"] == "normalProgress" && x["MonitoredVehicleJourney"]["DirectionRef"] == "0"; });
        direction_0.resize(std::distance(direction_0.begin(), copy_0));

        std::vector<json> direction_1(buses.size());
        auto copy_1 = std::copy_if(buses.begin(), buses.end(), direction_1.begin(), [](json x) { return x["MonitoredVehicleJourney"]["ProgressRate"] == "normalProgress" && x["MonitoredVehicleJourney"]["DirectionRef"] == "1"; });
        direction_1.resize(std::distance(direction_1.begin(), copy_1));

        json_vec_vec separated = {direction_0, direction_1};
        return separated;
}

std::function<std::vector<json>(std::vector<json>)> position_data(std::string route)
{
        return [route](std::vector<json> in) {
                auto filter = [route](json x) {
                        std::string key = route + "_" + x["MonitoredVehicleJourney"]["DirectionRef"].get<std::string>();
                        double dist;

                        dist = x["MonitoredVehicleJourney"]["MonitoredCall"]["Extensions"]["Distances"]["CallDistanceAlongRoute"].get<double>() - x["MonitoredVehicleJourney"]["MonitoredCall"]["Extensions"]["Distances"]["DistanceFromCall"].get<double>();

                        json j = {
                            {"RecordedAtTime", x["RecordedAtTime"]},
                            {"PublishedLineName", x["MonitoredVehicleJourney"]["PublishedLineName"]},
                            {"DestinationName", x["MonitoredVehicleJourney"]["DestinationName"]},
                            {"DirectionRef", x["MonitoredVehicleJourney"]["DirectionRef"]},
                            {"VehicleRef", x["MonitoredVehicleJourney"]["VehicleRef"]},
                            {"Longitude", x["MonitoredVehicleJourney"]["VehicleLocation"]["Longitude"]},
                            {"Latitude", x["MonitoredVehicleJourney"]["VehicleLocation"]["Latitude"]},
                            {"DatedVehicleJourneyRef", x["MonitoredVehicleJourney"]["FramedVehicleJourneyRef"]["DatedVehicleJourneyRef"]},
                            {"DistanceAlongRoute", dist}};
                        return j;
                };

                in.erase(std::remove_if(in.begin(), in.end(), [](json j) { return (j["MonitoredVehicleJourney"]["MonitoredCall"]["Extensions"]["Distances"]["CallDistanceAlongRoute"].is_null()); }), in.end());
                std::vector<json> out(in.size());
                std::transform(in.begin(), in.end(), out.begin(), filter);
                std::sort(out.begin(), out.end(), [](json a, json b) { return (a["DistanceAlongRoute"].get<double>() < b["DistanceAlongRoute"].get<double>()); });
                return out;
        };
}

json_vec_vec transform_jsons(json_vec_vec in, std::string route)
{
        json_vec_vec out(in.size());
        std::transform(in.begin(), in.end(), out.begin(), position_data(route));
        return out;
}

void db_connection(SharedQueue<std::string> &queue)
{
        pqxx::connection c("postgresql://postgres:password@localhost/buses");
        std::mutex mutex_;
        std::condition_variable cond_;

        while (true)
        {
                if (queue.size() > 0)
                {
                        pqxx::nontransaction txn(c);

                        if (queue.front() != "")
                        {
                                try
                                {
                                        txn.exec(queue.front());
                                        queue.pop_front();
                                }
                                catch (const std::exception &e)
                                {
                                        std::cerr << e.what() << '\n'
                                                  << queue.front() << '\n';

                                        queue.pop_front();
                                }
                        }
                        else
                                queue.pop_front();
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
}

void track(std::string route, std::string boro, SharedQueue<std::string> &queue)
{
        while (true)
        {
                json j = fetch("bustime.mta.info", "80", "/api/siri/vehicle-monitoring.json?LineRef=" + route + "&key=e76036fc-f470-4344-8df0-ce31c6cf01eb");

                if (j.is_object())
                {
                        if (j["Siri"]["ServiceDelivery"]["VehicleMonitoringDelivery"][0]["VehicleActivity"].is_array() && j["Siri"]["ServiceDelivery"]["VehicleMonitoringDelivery"][0]["VehicleActivity"].size() > 0)
                        {
                                auto directions = transform_jsons(separate_directions(j), route);
                                std::time_t t = std::time(nullptr);
                                std::stringstream ss;
                                ss << std::put_time(std::localtime(&t), "%c %Z");
                                // std::cout << "==============================================" + route + "=======================================\n";
                                // for (auto &x : data)
                                //         for (auto &y : x)
                                //                 std::cout << y.dump(8) << "\n";
                                for (auto &dir : directions)
                                {
                                        for (auto &obj : dir)
                                        {
                                                std::string query = "INSERT INTO " + boro + " VALUES (" + "'" + ss.str() + "', ";

                                                for (auto it : obj)
                                                {
                                                        if (it.is_number())
                                                                query += std::to_string(it.get<double>()) + ", ";
                                                        else
                                                                query += "'" + it.get<std::string>() + "'" + ", ";
                                                }
                                                query += ");";
                                                query.erase(query.rfind(","), 1);
                                                queue.push_back(query);
                                        }
                                }
                        }
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(30'000));
        }
}
