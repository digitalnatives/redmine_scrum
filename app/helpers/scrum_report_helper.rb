module ScrumReportHelper

  def sum_te_remaining_hours(data)
    sum = 0
    data.each do |row|
      sum += row['te_remaining_hours'].to_f
    end
    sum
  end

end
